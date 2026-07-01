package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.data.cache.CachePolicy
import org.auibar.aris.mobile.data.local.dao.KpiSnapshotDao
import org.auibar.aris.mobile.data.local.entity.KpiSnapshotEntity
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.api.DashboardChartsResponse
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.util.TokenManager
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

/**
 * In-memory KPI cache entry with timestamp for stale-while-revalidate.
 */
private data class KpiCacheEntry(
    val kpis: List<KpiCard>,
    val fetchedAt: Long = System.currentTimeMillis(),
)

@Singleton
class DashboardRepository @Inject constructor(
    private val analyticsApi: AnalyticsApi,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val kpiSnapshotDao: KpiSnapshotDao,
    private val cachePolicy: CachePolicy,
    private val tokenManager: TokenManager,
) {
    private val kpiCache = ConcurrentHashMap<String, KpiCacheEntry>()

    suspend fun getKpis(forceRefresh: Boolean = false): Result<List<KpiCard>> {
        return getCachedOrFetch(CachePolicy.KEY_KPI_HEALTH, forceRefresh) {
            analyticsApi.getHealthKpis().data?.kpis ?: emptyList()
        }
    }

    suspend fun getContinentalKpis(forceRefresh: Boolean = false): Result<List<KpiCard>> {
        return getCachedOrFetch(CachePolicy.KEY_KPI_CONTINENTAL, forceRefresh) {
            analyticsApi.getContinentalKpis().data?.kpis ?: emptyList()
        }
    }

    suspend fun getDomainKpis(domainKey: String, forceRefresh: Boolean = false): Result<List<KpiCard>> {
        return getCachedOrFetch(CachePolicy.keyKpiDomain(domainKey), forceRefresh) {
            analyticsApi.getDomainKpis(domainKey).data?.kpis ?: emptyList()
        }
    }

    fun getActiveCampaigns(): Flow<List<Campaign>> {
        val userDomains = tokenManager.getUserDomainList()
        return if (userDomains.isEmpty()) {
            campaignRepository.getActiveCampaigns()
        } else {
            val mobileDomains = userDomains.map { backendToMobileKey(it) }
            campaignRepository.getActiveCampaignsByDomains(mobileDomains)
        }
    }

    fun getPendingCount() = submissionRepository.getPendingCount()

    /** Map backend domain codes to mobile campaign domain keys */
    private fun backendToMobileKey(code: String): String = when (code) {
        "animal-health" -> "health"
        "livestock-prod" -> "livestock"
        "trade-sps" -> "trade"
        "climate-env" -> "climate"
        "knowledge-hub" -> "knowledge"
        else -> code // fisheries, wildlife, apiculture, governance — same
    }

    /** Dashboard charts with Room persistence */
    suspend fun getCharts(forceRefresh: Boolean = false): Result<DashboardChartsResponse> {
        val roomKey = "charts"

        // 1. Check in-memory (fast)
        if (!forceRefresh) {
            val memCached = kpiCache[roomKey]
            if (memCached != null && System.currentTimeMillis() - memCached.fetchedAt < cachePolicy.kpiTtlMs) {
                val snapshot = kpiSnapshotDao.getById(roomKey)
                if (snapshot?.chartsJson != null) {
                    return try {
                        Result.success(json.decodeFromString<DashboardChartsResponse>(snapshot.chartsJson))
                    } catch (_: Exception) { Result.success(DashboardChartsResponse()) }
                }
            }
        }

        // 2. Fetch from network
        return try {
            val response = analyticsApi.getDashboardCharts()
            val charts = response.data ?: DashboardChartsResponse()
            // Persist to Room
            val entity = KpiSnapshotEntity(
                id = roomKey,
                chartsJson = json.encodeToString(charts),
                fetchedAt = System.currentTimeMillis(),
            )
            kpiSnapshotDao.upsert(entity)
            kpiCache[roomKey] = KpiCacheEntry(emptyList())
            Result.success(charts)
        } catch (e: Exception) {
            // Fallback to Room
            val snapshot = kpiSnapshotDao.getById(roomKey)
            if (snapshot?.chartsJson != null) {
                try {
                    Result.success(json.decodeFromString<DashboardChartsResponse>(snapshot.chartsJson))
                } catch (_: Exception) { Result.failure(e) }
            } else {
                Result.failure(e)
            }
        }
    }

    fun invalidateKpiCache() {
        kpiCache.clear()
    }

    /**
     * Stale-while-revalidate with Room persistence:
     * 1. Check in-memory cache
     * 2. If miss/stale → check Room
     * 3. If miss/stale → fetch from network → persist to Room + memory
     * 4. On network failure → fall back to Room → fall back to memory
     */
    private suspend fun getCachedOrFetch(
        cacheKey: String,
        forceRefresh: Boolean,
        fetcher: suspend () -> List<KpiCard>,
    ): Result<List<KpiCard>> {
        val memCached = kpiCache[cacheKey]
        val isMemStale = memCached == null ||
            System.currentTimeMillis() - memCached.fetchedAt > cachePolicy.kpiTtlMs

        // Return fresh in-memory cache
        if (!forceRefresh && memCached != null && !isMemStale) {
            return Result.success(memCached.kpis)
        }

        // Check Room if memory is stale
        if (!forceRefresh) {
            val roomSnapshot = kpiSnapshotDao.getById(cacheKey)
            if (roomSnapshot != null && System.currentTimeMillis() - roomSnapshot.fetchedAt < cachePolicy.kpiTtlMs) {
                val kpis = try { json.decodeFromString<List<KpiCard>>(roomSnapshot.kpisJson) } catch (_: Exception) { emptyList() }
                if (kpis.isNotEmpty()) {
                    kpiCache[cacheKey] = KpiCacheEntry(kpis, roomSnapshot.fetchedAt)
                    return Result.success(kpis)
                }
            }
        }

        // Fetch from network
        return try {
            val kpis = fetcher()
            val now = System.currentTimeMillis()
            kpiCache[cacheKey] = KpiCacheEntry(kpis, now)
            cachePolicy.markRefreshed(cacheKey)
            // Persist to Room
            kpiSnapshotDao.upsert(KpiSnapshotEntity(
                id = cacheKey,
                kpisJson = json.encodeToString(kpis),
                fetchedAt = now,
            ))
            Result.success(kpis)
        } catch (e: Exception) {
            // Fallback: Room → memory → failure
            val roomSnapshot = kpiSnapshotDao.getById(cacheKey)
            if (roomSnapshot != null) {
                val kpis = try { json.decodeFromString<List<KpiCard>>(roomSnapshot.kpisJson) } catch (_: Exception) { emptyList() }
                if (kpis.isNotEmpty()) return Result.success(kpis)
            }
            if (memCached != null) return Result.success(memCached.kpis)
            Result.failure(e)
        }
    }
}
