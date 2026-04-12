package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.BeneficiariesByCountryResponse
import org.auibar.aris.mobile.data.remote.dto.KpiResponse
import org.auibar.aris.mobile.data.remote.dto.SubmissionsByDomainResponse
import org.auibar.aris.mobile.data.remote.dto.SubmissionsTimelineResponse
import javax.inject.Inject

class AnalyticsApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getHealthKpis(): ApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/health/kpis").body()
    }

    suspend fun getContinentalKpis(): ApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/continental/kpis").body()
    }

    suspend fun getDomainKpis(domainKey: String): ApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/$domainKey/kpis").body()
    }

    suspend fun getSubmissionsByDomain(): ApiResponse<SubmissionsByDomainResponse> {
        return client.get("/api/v1/analytics/submissions/by-domain").body()
    }

    suspend fun getSubmissionsTimeline(period: String = "monthly"): ApiResponse<SubmissionsTimelineResponse> {
        return client.get("/api/v1/analytics/submissions/timeline") {
            parameter("period", period)
        }.body()
    }

    suspend fun getBeneficiariesByCountry(): ApiResponse<BeneficiariesByCountryResponse> {
        return client.get("/api/v1/analytics/beneficiaries/by-country").body()
    }
}
