package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.BeneficiariesByCountryResponse
import org.auibar.aris.mobile.data.remote.dto.KpiResponse
import org.auibar.aris.mobile.data.remote.dto.SubmissionsByDomainResponse
import org.auibar.aris.mobile.data.remote.dto.SubmissionsTimelineResponse
import kotlinx.serialization.Serializable
import javax.inject.Inject

@Serializable
data class ChartEntry(
    val label: String = "",
    val value: Int = 0,
)

@Serializable
data class TrendEntry(
    val month: String = "",
    val outbreaks: Int = 0,
    val reports: Int = 0,
)

@Serializable
data class DashboardChartsResponse(
    val diseaseDistribution: List<ChartEntry> = emptyList(),
    val countryDistribution: List<ChartEntry> = emptyList(),
    val monthlyTrend: List<TrendEntry> = emptyList(),
)

@Serializable
data class DomainSummaryKpiTrend(
    val current: Int = 0,
    val previous: Int = 0,
    val delta: Double = 0.0,
)

@Serializable
data class DomainSummaryKpis(
    val totalSubmissions: Int = 0,
    val activeCountries: Int = 0,
    val activeCampaigns: Int = 0,
    val completionRate: Double = 0.0,
    val qualityScore: Double = 0.0,
    val trend: DomainSummaryKpiTrend = DomainSummaryKpiTrend(),
)

@Serializable
data class CountryDistributionEntry(
    val code: String = "",
    val name: String = "",
    val count: Int = 0,
)

@Serializable
data class MonthlyTrendEntry(
    val month: String = "",
    val count: Int = 0,
)

@Serializable
data class SubDomainBreakdownEntry(
    val code: String = "",
    val label: String = "",
    val count: Int = 0,
)

@Serializable
data class DomainSynthesis(
    val countryDistribution: List<CountryDistributionEntry> = emptyList(),
    val monthlyTrend: List<MonthlyTrendEntry> = emptyList(),
    val subDomainBreakdown: List<SubDomainBreakdownEntry> = emptyList(),
)

@Serializable
data class DomainActivityEntry(
    val type: String = "",  // "submission", "validation", "campaign_start"
    val country: String? = null,
    val formName: String? = null,
    val timestamp: String = "",
)

@Serializable
data class DomainSummaryResponse(
    val kpis: DomainSummaryKpis = DomainSummaryKpis(),
    val synthesis: DomainSynthesis = DomainSynthesis(),
    val recentActivity: List<DomainActivityEntry> = emptyList(),
)

class AnalyticsApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getHealthKpis(): SafeApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/health/kpis").body()
    }

    suspend fun getContinentalKpis(): SafeApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/continental/kpis").body()
    }

    suspend fun getDomainKpis(domainKey: String): SafeApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/$domainKey/kpis").body()
    }

    suspend fun getDashboardCharts(): SafeApiResponse<DashboardChartsResponse> {
        return client.get("/api/v1/analytics/dashboard/charts").body()
    }

    suspend fun getSubmissionsByDomain(): SafeApiResponse<SubmissionsByDomainResponse> {
        return client.get("/api/v1/analytics/submissions/by-domain").body()
    }

    suspend fun getSubmissionsTimeline(period: String = "monthly"): SafeApiResponse<SubmissionsTimelineResponse> {
        return client.get("/api/v1/analytics/submissions/timeline") {
            parameter("period", period)
        }.body()
    }

    suspend fun getBeneficiariesByCountry(): SafeApiResponse<BeneficiariesByCountryResponse> {
        return client.get("/api/v1/analytics/beneficiaries/by-country").body()
    }

    suspend fun getDomainSummary(domainCode: String): DomainSummaryResponse {
        return try {
            val response: SafeApiResponse<DomainSummaryResponse> = client.get("/api/v1/analytics/domains/$domainCode/summary").body()
            response.data ?: DomainSummaryResponse()
        } catch (e: Exception) {
            Log.w("AnalyticsApi", "getDomainSummary($domainCode) failed: ${e.message}")
            DomainSummaryResponse()
        }
    }
}
