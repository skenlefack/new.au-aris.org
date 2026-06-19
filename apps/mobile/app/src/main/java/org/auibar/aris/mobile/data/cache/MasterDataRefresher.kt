package org.auibar.aris.mobile.data.cache

import android.util.Log
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.RefDataCacheDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.RefDataCacheEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.api.SyncApi
import javax.inject.Inject
import javax.inject.Singleton

private val json = Json { ignoreUnknownKeys = true }

@Singleton
class MasterDataRefresher @Inject constructor(
    private val syncApi: SyncApi,
    private val campaignApi: CampaignApi,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val refDataCacheDao: RefDataCacheDao,
    private val formTemplateDao: FormTemplateDao,
    private val cachePolicy: CachePolicy,
) {
    companion object {
        private const val TAG = "MasterDataRefresher"
        private const val KEY_REF_DATA = "cache_ref_data"
        // Types handled by dedicated tables — skip in generic ref data refresh
        private val DEDICATED_TYPES = setOf("species", "breeds", "diseases", "geo", "countries")
    }

    /**
     * Refresh master data if stale. Call this on app start.
     * Each category is refreshed independently — one failure doesn't block others.
     */
    suspend fun refreshIfNeeded() {
        refreshSpeciesIfNeeded()
        refreshDiseasesIfNeeded()
        refreshGeoIfNeeded()
        refreshRefDataIfNeeded()
    }

    suspend fun forceRefreshAll() {
        refreshSpecies()
        refreshDiseases()
        refreshGeo()
        refreshAllRefData()
    }

    private suspend fun refreshSpeciesIfNeeded() {
        if (cachePolicy.isStale(CachePolicy.KEY_MASTER_SPECIES, cachePolicy.masterDataTtlMs)) {
            refreshSpecies()
        }
    }

    private suspend fun refreshDiseasesIfNeeded() {
        if (cachePolicy.isStale(CachePolicy.KEY_MASTER_DISEASES, cachePolicy.masterDataTtlMs)) {
            refreshDiseases()
        }
    }

    private suspend fun refreshGeoIfNeeded() {
        if (cachePolicy.isStale(CachePolicy.KEY_MASTER_GEO, cachePolicy.masterDataTtlMs)) {
            refreshGeo()
        }
    }

    private suspend fun refreshRefDataIfNeeded() {
        if (cachePolicy.isStale(KEY_REF_DATA, cachePolicy.masterDataTtlMs)) {
            refreshAllRefData()
        }
    }

    /**
     * Scan all cached form templates, extract unique masterDataType values,
     * and pre-fetch ref data for each type so forms work offline.
     */
    private suspend fun refreshAllRefData() {
        try {
            val types = extractAllMasterDataTypes()
            if (types.isEmpty()) {
                Log.d(TAG, "No custom ref data types found in templates")
                return
            }
            Log.d(TAG, "Pre-fetching ref data for ${types.size} types: $types")
            var totalCached = 0
            for (type in types) {
                try {
                    val items = campaignApi.getRefDataForSelect(type)
                    if (items.isNotEmpty()) {
                        val entities = items.mapIndexed { idx, item ->
                            RefDataCacheEntity(
                                type = type,
                                itemId = item.id,
                                label = item.displayLabel(),
                                sortOrder = idx,
                            )
                        }
                        refDataCacheDao.deleteByType(type)
                        refDataCacheDao.upsertAll(entities)
                        totalCached += entities.size
                        Log.d(TAG, "Cached $type: ${entities.size} items")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to cache ref data type '$type': ${e.message}")
                }
            }
            cachePolicy.markRefreshed(KEY_REF_DATA)
            Log.d(TAG, "Ref data pre-fetch complete: $totalCached items across ${types.size} types")
        } catch (e: Exception) {
            Log.w(TAG, "Ref data pre-fetch failed", e)
        }
    }

    /**
     * Parse all cached form template schemas to find unique masterDataType values.
     * This identifies which ref data types need to be pre-fetched for offline use.
     */
    private suspend fun extractAllMasterDataTypes(): Set<String> {
        val types = mutableSetOf<String>()
        val templates = try { formTemplateDao.getAll() } catch (_: Exception) { emptyList() }
        for (template in templates) {
            try {
                val schemaStr = template.schema
                if (schemaStr.isBlank() || !schemaStr.trimStart().startsWith("{")) continue
                val root = json.parseToJsonElement(schemaStr).jsonObject
                val sections = root["sections"]?.jsonArray ?: continue
                for (sec in sections) {
                    val fields = sec.jsonObject["fields"]?.jsonArray ?: continue
                    for (f in fields) {
                        val fObj = f.jsonObject
                        val fieldType = fObj["type"]?.jsonPrimitive?.content ?: continue
                        if (fieldType == "master-data-select" || fieldType == "select") {
                            val mdt = fObj["properties"]?.jsonObject
                                ?.get("masterDataType")?.jsonPrimitive?.content
                            if (mdt != null && mdt !in DEDICATED_TYPES) {
                                types.add(mdt)
                            }
                        }
                    }
                }
            } catch (_: Exception) {
                // Skip unparseable templates
            }
        }
        return types
    }

    private suspend fun refreshSpecies() {
        try {
            val response = syncApi.fetchSpecies()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                SpeciesEntity(
                    id = dto.id,
                    commonName = dto.resolvedName,
                    scientificName = dto.scientificName ?: "",
                    category = dto.category ?: "OTHER",
                    syncedAt = now,
                )
            }
            speciesDao.upsertAll(entities)
            cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_SPECIES)
            Log.d(TAG, "Species refreshed: ${entities.size} items")
        } catch (e: Exception) {
            Log.w(TAG, "Species refresh failed, using cache", e)
        }
    }

    private suspend fun refreshDiseases() {
        try {
            val response = syncApi.fetchDiseases()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                DiseaseEntity(
                    id = dto.id,
                    name = dto.resolvedName,
                    woahCode = dto.woahCode,
                    category = dto.category ?: "OTHER",
                    isNotifiable = dto.isNotifiable,
                    syncedAt = now,
                )
            }
            diseaseDao.upsertAll(entities)
            cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_DISEASES)
            Log.d(TAG, "Diseases refreshed: ${entities.size} items")
        } catch (e: Exception) {
            Log.w(TAG, "Diseases refresh failed, using cache", e)
        }
    }

    private suspend fun refreshGeo() {
        try {
            val response = syncApi.fetchGeoUnits()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                GeoEntity(
                    id = dto.id,
                    name = dto.name,
                    level = dto.level,
                    parentId = dto.parentId,
                    isoCode = dto.isoCode,
                    syncedAt = now,
                )
            }
            geoDao.upsertAll(entities)
            cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_GEO)
            Log.d(TAG, "Geo units refreshed: ${entities.size} items")
        } catch (e: Exception) {
            Log.w(TAG, "Geo refresh failed, using cache", e)
        }
    }
}
