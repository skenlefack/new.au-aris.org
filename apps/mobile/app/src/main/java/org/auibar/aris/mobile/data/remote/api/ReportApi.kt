package org.auibar.aris.mobile.data.remote.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.readBytes
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import java.io.File
import javax.inject.Inject

@Serializable
data class ReportDto(
    val id: String,
    val templateCode: String = "",
    val type: String = "PERIODIC",
    val status: String = "PUBLISHED",
    val titleFr: String = "",
    val titleEn: String = "",
    val themeFr: String? = null,
    val themeEn: String? = null,
    val periodStart: Long = 0,
    val periodEnd: Long = 0,
    val referenceYear: Int? = null,
    val scope: String = "CONTINENTAL",
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val countryCode: String? = null,
    val recCode: String? = null,
    val pdfRemoteUrl: String? = null,
    val pdfSizeBytes: Long? = null,
    val publishedAt: Long? = null,
)

class ReportApi @Inject constructor(
    private val http: HttpClient,
    private val baseUrl: String,
) {
    suspend fun listPublished(domainCode: String? = null): ApiResponse<List<ReportDto>> =
        http.get("$baseUrl/api/v1/analytics/reports") {
            parameter("status", "PUBLISHED")
            domainCode?.let { parameter("domainCode", it) }
        }.body()

    suspend fun downloadPdf(pdfUrl: String, targetFile: File): Result<File> {
        return try {
            val response = http.get(pdfUrl)
            val bytes = response.readBytes()
            if (bytes.size > 10 * 1024 * 1024) {
                return Result.failure(IllegalStateException("PDF exceeds 10MB limit"))
            }
            targetFile.parentFile?.mkdirs()
            targetFile.writeBytes(bytes)
            Result.success(targetFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
