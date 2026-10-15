package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import org.auibar.aris.mobile.data.remote.dto.MdmAckRequest
import org.auibar.aris.mobile.data.remote.dto.MdmEnrollRequest
import org.auibar.aris.mobile.data.remote.dto.MdmEnrollResponse
import org.auibar.aris.mobile.data.remote.dto.MdmHeartbeatRequest
import org.auibar.aris.mobile.data.remote.dto.MdmHeartbeatResponse
import org.auibar.aris.mobile.data.remote.dto.MdmUpdateDto
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import javax.inject.Inject

private const val TAG = "MdmApi"

class MdmApi @Inject constructor(
    private val client: HttpClient,
) {

    suspend fun enroll(request: MdmEnrollRequest): MdmEnrollResponse? {
        return try {
            val response = client.post("/api/v1/credential/mdm/enroll") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.value !in 200..299) {
                Log.w(TAG, "enroll -> HTTP ${response.status.value}")
                return null
            }
            val body: SafeApiResponse<MdmEnrollResponse> = response.body()
            body.data
        } catch (e: Exception) {
            Log.w(TAG, "enroll failed: ${e.message}")
            null
        }
    }

    suspend fun heartbeat(request: MdmHeartbeatRequest): MdmHeartbeatResponse? {
        return try {
            val response = client.post("/api/v1/credential/mdm/heartbeat") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.value !in 200..299) {
                Log.w(TAG, "heartbeat -> HTTP ${response.status.value}")
                return null
            }
            val body: SafeApiResponse<MdmHeartbeatResponse> = response.body()
            body.data
        } catch (e: Exception) {
            Log.w(TAG, "heartbeat failed: ${e.message}")
            null
        }
    }

    suspend fun acknowledgeCommand(commandId: String, request: MdmAckRequest): Boolean {
        return try {
            val response = client.post("/api/v1/credential/mdm/commands/$commandId/ack") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            val success = response.status.value in 200..299
            if (!success) {
                Log.w(TAG, "ackCommand $commandId -> HTTP ${response.status.value}")
            }
            success
        } catch (e: Exception) {
            Log.w(TAG, "ackCommand $commandId failed: ${e.message}")
            false
        }
    }

    suspend fun checkVersion(currentVersionCode: Int): MdmUpdateDto? {
        return try {
            val response = client.get("/api/v1/credential/mdm/version-check") {
                parameter("currentVersionCode", currentVersionCode)
            }
            if (response.status.value !in 200..299) {
                Log.w(TAG, "checkVersion -> HTTP ${response.status.value}")
                return null
            }
            val body: SafeApiResponse<MdmUpdateDto> = response.body()
            body.data
        } catch (e: Exception) {
            Log.w(TAG, "checkVersion failed: ${e.message}")
            null
        }
    }
}
