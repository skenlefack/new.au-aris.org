package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import javax.inject.Inject

@Serializable
data class FlashAlertDto(
    val id: String,
    val alertCode: String = "",
    val severity: String = "LOW",
    val sourceType: String = "INDICATOR",
    val sourceId: String? = null,
    val countryCode: String? = null,
    val recCode: String? = null,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val titleFr: String = "",
    val titleEn: String = "",
    val detectedAt: Long = 0,
    val triggerDataJson: String? = null,
    val status: String = "ACTIVE",
    val relatedReportId: String? = null,
)

class FlashAlertApi @Inject constructor(
    private val http: HttpClient,
    private val baseUrl: String,
) {
    suspend fun list(): ApiResponse<List<FlashAlertDto>> =
        http.get("$baseUrl/api/v1/analytics/flash-alerts").body()

    suspend fun dismiss(id: String): ApiResponse<FlashAlertDto> =
        http.post("$baseUrl/api/v1/analytics/flash-alerts/$id/dismiss").body()
}
