package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.cache.CachePolicy
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.util.TokenManager
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

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
    private val cachePolicy: CachePolicy,
    private val tokenManager: TokenManager,
) {
    private val kpiCache = ConcurrentHashMap<String, KpiCacheEntry>()

    suspend fun getKpis(forceRefresh: Boolean = false): Result<List<KpiCard>> {
        return getCachedOrFetch(CachePolicy.KEY_KPI_HEALTH, forceRefresh) {
            analyticsApi.getHealthKpis().data.kpis
        }
    }

    suspend fun getContinentalKpis(forceRefresh: Boolean = false): Result<List<KpiCard>> {
        return getCachedOrFetch(CachePolicy.KEY_KPI_CONTINENTAL, forceRefresh) {
            analyticsApi.getContinentalKpis().data.kpis
        }
    }

    suspend fun getDomainKpis(domainKey: String, forceRefresh: Boolean = false): Result<List<KpiCard>> {
        return getCachedOrFetch(CachePolicy.keyKpiDomain(domainKey), forceRefresh) {
            analyticsApi.getDomainKpis(domainKey).data.kpis
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

    fun invalidateKpiCache() {
        kpiCache.clear()
    }

    /**
     * Stale-while-revalidate: return cached data immediately if available,
     * fetch fresh data only if cache is stale or missing.
     * On network failure, fall back to stale cache if present.
     */
    private suspend fun getCachedOrFetch(
        cacheKey: String,
        forceRefresh: Boolean,
        fetcher: suspend () -> List<KpiCard>,
    ): Result<List<KpiCard>> {
        val cached = kpiCache[cacheKey]
        val isStale = cached == null ||
            System.currentTimeMillis() - cached.fetchedAt > cachePolicy.kpiTtlMs

        // Return fresh cache immediately if not stale and not forced
        if (!forceRefresh && cached != null && !isStale) {
            return Result.success(cached.kpis)
        }

        // Fetch from network
        return try {
            val kpis = fetcher()
            kpiCache[cacheKey] = KpiCacheEntry(kpis)
            cachePolicy.markRefreshed(cacheKey)
            Result.success(kpis)
        } catch (e: Exception) {
            // Stale-while-revalidate: return stale cache on network error
            if (cached != null) {
                Result.success(cached.kpis)
            } else {
                Result.failure(e)
            }
        }
    }
}
