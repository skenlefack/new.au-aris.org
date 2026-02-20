package org.auibar.aris.mobile.data.cache

import android.util.Log
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.remote.api.SyncApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MasterDataRefresher @Inject constructor(
    private val syncApi: SyncApi,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val cachePolicy: CachePolicy,
) {
    companion object {
        private const val TAG = "MasterDataRefresher"
    }

    /**
     * Refresh master data if stale. Call this on app start.
     * Each category is refreshed independently — one failure doesn't block others.
     */
    suspend fun refreshIfNeeded() {
        refreshSpeciesIfNeeded()
        refreshDiseasesIfNeeded()
        refreshGeoIfNeeded()
    }

    suspend fun forceRefreshAll() {
        refreshSpecies()
        refreshDiseases()
        refreshGeo()
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

    private suspend fun refreshSpecies() {
        try {
            val response = syncApi.fetchSpecies()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                SpeciesEntity(
                    id = dto.id,
                    commonName = dto.commonName,
                    scientificName = dto.scientificName,
                    category = dto.category,
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
                    name = dto.name,
                    woahCode = dto.woahCode,
                    category = dto.category,
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
