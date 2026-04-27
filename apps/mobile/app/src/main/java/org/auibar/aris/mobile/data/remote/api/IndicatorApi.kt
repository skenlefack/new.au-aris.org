package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import javax.inject.Inject

@Serializable
data class IndicatorDto(
    val id: String,
    val code: String,
    val nameFr: String = "",
    val nameEn: String = "",
    val nameAr: String? = null,
    val namePt: String? = null,
    val descriptionFr: String? = null,
    val descriptionEn: String? = null,
    val typeCode: String,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val unit: String = "",
    val decimalPlaces: Int = 2,
    val targetValue: Double? = null,
    val betterIsHigher: Boolean = true,
    val measurementMode: String = "MANUAL_ENTRY",
    val formulaExpression: String? = null,
    val lastValue: Double? = null,
    val lastValueAt: Long? = null,
    val previousValue: Double? = null,
    val trend: String? = null,
    val active: Boolean = true,
)

@Serializable
data class IndicatorValueDto(
    val id: String,
    val indicatorId: String,
    val year: Int,
    val month: Int? = null,
    val quarter: Int? = null,
    val countryCode: String? = null,
    val recCode: String? = null,
    val isContinental: Boolean = false,
    val value: Double,
    val source: String? = null,
)

class IndicatorApi @Inject constructor(
    private val http: HttpClient,
    private val baseUrl: String,
) {
    suspend fun list(domainCode: String? = null): ApiResponse<List<IndicatorDto>> =
        http.get("$baseUrl/api/v1/analytics/indicators") {
            domainCode?.let { parameter("domainCode", it) }
            parameter("active", true)
        }.body()

    suspend fun getValues(indicatorCode: String, limit: Int = 24): ApiResponse<List<IndicatorValueDto>> =
        http.get("$baseUrl/api/v1/analytics/indicators/$indicatorCode/values") {
            parameter("limit", limit)
        }.body()
}
