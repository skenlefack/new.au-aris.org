package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import javax.inject.Inject

@Serializable
data class DashboardSummaryDto(
    val id: String,
    val ownership: String = "SYSTEM",
    val scope: String = "CONTINENTAL",
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val titleFr: String = "",
    val titleEn: String = "",
    val titleAr: String? = null,
    val titlePt: String? = null,
    val description: String? = null,
    val gridColumns: Int = 12,
    val rowHeight: Int = 80,
    val ownerUserId: String? = null,
    val isDefault: Boolean = false,
)

@Serializable
data class DashboardWidgetDto(
    val id: String,
    val dashboardId: String,
    val type: String,
    val dataSource: String = "INDICATOR",
    val gridX: Int = 0,
    val gridY: Int = 0,
    val gridW: Int = 12,
    val gridH: Int = 2,
    val titleFr: String = "",
    val titleEn: String = "",
    val configJson: String = "{}",
)

@Serializable
data class DashboardRenderedDto(
    val dashboard: DashboardSummaryDto,
    val widgets: List<DashboardWidgetDto> = emptyList(),
)

class DashboardMobileApi @Inject constructor(
    private val http: HttpClient,
    private val baseUrl: String,
) {
    suspend fun listAccessible(scope: String? = null): ApiResponse<List<DashboardSummaryDto>> =
        http.get("$baseUrl/api/v1/dashboards") {
            scope?.let { parameter("scope", it) }
        }.body()

    suspend fun render(dashboardId: String): ApiResponse<DashboardRenderedDto> =
        http.get("$baseUrl/api/v1/dashboards/$dashboardId/render").body()
}
