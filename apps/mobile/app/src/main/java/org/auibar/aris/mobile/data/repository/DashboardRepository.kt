package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import javax.inject.Inject

class DashboardRepository @Inject constructor(
    private val analyticsApi: AnalyticsApi,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
) {

    suspend fun getKpis(): Result<List<KpiCard>> {
        return try {
            val response = analyticsApi.getHealthKpis()
            Result.success(response.data.kpis)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getActiveCampaigns() = campaignRepository.getActiveCampaigns()

    fun getPendingCount() = submissionRepository.getPendingCount()
}
