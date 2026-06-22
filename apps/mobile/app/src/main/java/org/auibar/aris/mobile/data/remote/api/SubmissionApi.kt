package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.ConflictResolutionBody
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.SubmissionListItemDto
import org.auibar.aris.mobile.data.remote.dto.SubmissionUpdateBody
import javax.inject.Inject

private const val TAG = "SubmissionApi"

class SubmissionApi @Inject constructor(
    private val client: HttpClient,
) {
    /** List submissions for a campaign with filters. */
    suspend fun listByCampaign(
        campaignId: String,
        status: String? = null,
        page: Int = 1,
        limit: Int = 20,
    ): SafeApiResponse<List<SubmissionListItemDto>> {
        return try {
            val response = client.get("/api/v1/collecte/submissions") {
                parameter("campaign", campaignId)
                status?.let { parameter("status", it) }
                parameter("page", page)
                parameter("limit", limit)
            }
            if (response.status.value !in 200..299) {
                Log.w(TAG, "List submissions -> HTTP ${response.status.value}")
                return SafeApiResponse(data = emptyList())
            }
            response.body()
        } catch (e: Exception) {
            Log.w(TAG, "List submissions failed: ${e.message}")
            SafeApiResponse(data = emptyList())
        }
    }

    /** Get a single submission by ID. */
    suspend fun getById(submissionId: String): SubmissionListItemDto? {
        return try {
            val response = client.get("/api/v1/collecte/submissions/$submissionId")
            if (response.status.value !in 200..299) return null
            val body: SafeApiResponse<SubmissionListItemDto> = response.body()
            body.data
        } catch (e: Exception) {
            Log.w(TAG, "Get submission failed: ${e.message}")
            null
        }
    }

    /** Update submission data (for RETURNED/REJECTED corrections). */
    suspend fun updateData(submissionId: String, data: kotlinx.serialization.json.JsonObject): Boolean {
        return try {
            val response = client.patch("/api/v1/collecte/submissions/$submissionId/data") {
                contentType(ContentType.Application.Json)
                setBody(SubmissionUpdateBody(data = data))
            }
            val ok = response.status.value in 200..299
            if (!ok) Log.w(TAG, "Update data -> HTTP ${response.status.value}")
            ok
        } catch (e: Exception) {
            Log.w(TAG, "Update data failed: ${e.message}")
            false
        }
    }

    /** Resolve a sync conflict. */
    suspend fun resolveConflict(
        submissionId: String,
        resolution: String,
        mergedData: kotlinx.serialization.json.JsonObject? = null,
    ): Boolean {
        return try {
            val response = client.patch("/api/v1/collecte/submissions/$submissionId/resolve-conflict") {
                contentType(ContentType.Application.Json)
                setBody(ConflictResolutionBody(resolution = resolution, mergedData = mergedData))
            }
            val ok = response.status.value in 200..299
            if (!ok) Log.w(TAG, "Resolve conflict -> HTTP ${response.status.value}")
            ok
        } catch (e: Exception) {
            Log.w(TAG, "Resolve conflict failed: ${e.message}")
            false
        }
    }

    /** List submissions in conflict status. */
    suspend fun listConflicts(page: Int = 1, limit: Int = 20): SafeApiResponse<List<SubmissionListItemDto>> {
        return try {
            val response = client.get("/api/v1/collecte/submissions/conflicts") {
                parameter("page", page)
                parameter("limit", limit)
            }
            if (response.status.value !in 200..299) return SafeApiResponse(data = emptyList())
            response.body()
        } catch (e: Exception) {
            Log.w(TAG, "List conflicts failed: ${e.message}")
            SafeApiResponse(data = emptyList())
        }
    }
}
