package org.auibar.aris.mobile.data.cache

import android.util.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

data class PrefetchProgress(
    val completed: Int,
    val total: Int,
    val currentStep: String,
)

@Singleton
class OfflinePrefetcher @Inject constructor(
    private val campaignRefresher: CampaignRefresher,
    private val masterDataRefresher: MasterDataRefresher,
    private val dashboardRepository: org.auibar.aris.mobile.data.repository.DashboardRepository,
) {
    companion object {
        private const val TAG = "OfflinePrefetcher"
        private const val TOTAL_STEPS = 4
    }

    /**
     * Pre-fetch all data needed for offline use.
     * Emits progress updates. Each step is fail-safe.
     */
    fun prefetchAll(): Flow<PrefetchProgress> = flow {
        var completed = 0

        emit(PrefetchProgress(completed, TOTAL_STEPS, "Syncing campaigns & templates..."))
        try {
            campaignRefresher.forceRefresh() // This now also pre-caches templates
        } catch (e: Exception) {
            Log.w(TAG, "Campaign prefetch failed", e)
        }
        completed++

        emit(PrefetchProgress(completed, TOTAL_STEPS, "Loading reference data..."))
        try {
            masterDataRefresher.forceRefreshAll()
        } catch (e: Exception) {
            Log.w(TAG, "Master data prefetch failed", e)
        }
        completed++

        emit(PrefetchProgress(completed, TOTAL_STEPS, "Loading dashboard..."))
        try {
            dashboardRepository.getContinentalKpis(forceRefresh = true)
        } catch (e: Exception) {
            Log.w(TAG, "KPI prefetch failed", e)
        }
        completed++

        emit(PrefetchProgress(completed, TOTAL_STEPS, "Finalizing..."))
        completed++

        emit(PrefetchProgress(completed, TOTAL_STEPS, "Complete"))
    }
}
