package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.KpiResponse
import javax.inject.Inject

class AnalyticsApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun getHealthKpis(): ApiResponse<KpiResponse> {
        return client.get("/api/v1/analytics/health/kpis").body()
    }
}
