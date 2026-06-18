package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import javax.inject.Inject

private const val TAG = "ValidationApi"

@Serializable
data class ValidationItemDto(
    val id: String,
    val entityType: String = "",
    val entityId: String = "",
    val tenantId: String = "",
    val domain: String = "",
    val currentLevel: String = "NATIONAL_TECHNICAL",
    val status: String = "PENDING",
    val createdBy: String = "",
    val createdAt: String = "",
    val updatedAt: String = "",
    // Optional fields that may not always be present
    val dataContractId: String? = null,
    val qualityReportId: String? = null,
    val wahisReady: Boolean = false,
    val analyticsReady: Boolean = false,
    val slaDeadline: String? = null,
)

@Serializable
data class ValidationActionBody(
    val comment: String? = null,
    val reason: String? = null,
)

@Serializable
data class UpdateSubmissionStatusBody(
    val status: String,
    val reason: String? = null,
)

@Serializable
data class ValidationMeta(
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 10,
)

@Serializable
data class ValidationListResponse(
    val data: List<ValidationItemDto> = emptyList(),
    val meta: ValidationMeta? = null,
)

class ValidationApi @Inject constructor(
    private val client: HttpClient,
) {

    suspend fun getValidations(
        page: Int = 1,
        limit: Int = 10,
        level: String? = null,
        status: String? = null,
        entityType: String? = null,
    ): ValidationListResponse {
        return try {
            val response = client.get("/api/v1/workflow/instances") {
                parameter("page", page)
                parameter("limit", limit)
                level?.let { parameter("level", it) }
                status?.let { parameter("status", it) }
                entityType?.let { parameter("entityType", it) }
            }
            if (response.status.value !in 200..299) {
                Log.w(TAG, "getValidations → HTTP ${response.status.value}")
                return ValidationListResponse()
            }
            response.body()
        } catch (e: Exception) {
            Log.w(TAG, "getValidations failed: ${e.message}")
            ValidationListResponse()
        }
    }

    suspend fun performAction(
        id: String,
        action: String,
        comment: String? = null,
        reason: String? = null,
    ): Boolean {
        return try {
            val endpoint = "/api/v1/workflow/instances/$id/$action"
            val response = client.post(endpoint) {
                contentType(ContentType.Application.Json)
                setBody(ValidationActionBody(comment = comment, reason = reason))
            }
            val success = response.status.value in 200..299
            if (!success) {
                Log.w(TAG, "$action $id → HTTP ${response.status.value}")
            }
            success
        } catch (e: Exception) {
            Log.w(TAG, "$action $id failed: ${e.message}")
            false
        }
    }

    /**
     * Update submission status directly via collecte service.
     * PATCH /api/v1/collecte/submissions/:id/status
     * @param status "VALIDATED" or "REJECTED"
     */
    suspend fun updateSubmissionStatus(
        submissionId: String,
        status: String,
        reason: String? = null,
    ): Boolean {
        return try {
            val response = client.patch("/api/v1/collecte/submissions/$submissionId/status") {
                contentType(ContentType.Application.Json)
                setBody(UpdateSubmissionStatusBody(status = status, reason = reason))
            }
            val success = response.status.value in 200..299
            if (!success) {
                Log.w(TAG, "updateSubmissionStatus $submissionId → HTTP ${response.status.value}")
            }
            success
        } catch (e: Exception) {
            Log.w(TAG, "updateSubmissionStatus $submissionId failed: ${e.message}")
            false
        }
    }
}
