package org.auibar.aris.mobile.data.remote.api

import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.AppDomainDto
import org.auibar.aris.mobile.data.remote.dto.I18nConfigDto
import org.auibar.aris.mobile.data.remote.dto.LoginRequest
import org.auibar.aris.mobile.data.remote.dto.LoginResponse
import javax.inject.Inject

/** Thrown when the backend returns 403 because the temporary account has expired. */
class AccountExpiredException(message: String) : Exception(message)

class AuthApi @Inject constructor(
    private val client: HttpClient,
) {
    suspend fun refreshToken(refreshToken: String): ApiResponse<LoginResponse> {
        val response = try {
            client.post("/api/v1/credential/auth/refresh") {
                contentType(ContentType.Application.Json)
                setBody(RefreshRequest(refreshToken = refreshToken))
            }
        } catch (e: Exception) {
            Log.e("AuthApi", "Network error during token refresh", e)
            throw Exception("Token refresh failed: ${e.message}")
        }

        if (response.status.value == 403) {
            throw AccountExpiredException("Your temporary account has expired. Contact your administrator.")
        }
        if (response.status.value !in 200..299) {
            throw Exception("Token refresh failed (HTTP ${response.status.value})")
        }
        return response.body()
    }

    suspend fun login(email: String, password: String, totpCode: String? = null): ApiResponse<LoginResponse> {
        val response = try {
            client.post("/api/v1/credential/auth/login") {
                contentType(ContentType.Application.Json)
                setBody(LoginRequest(email = email, password = password, totpCode = totpCode))
            }
        } catch (e: Exception) {
            Log.e("AuthApi", "Network error during login", e)
            throw Exception("Cannot reach server: ${e.javaClass.simpleName} — ${e.message}")
        }

        Log.d("AuthApi", "Login response status: ${response.status.value}")

        if (response.status.value !in 200..299) {
            val rawBody = try { response.bodyAsText() } catch (_: Exception) { "" }
            Log.e("AuthApi", "Login error ${response.status.value}: $rawBody")
            val errorBody = try {
                response.body<ErrorResponse>()
            } catch (_: Exception) {
                null
            }
            val msg = errorBody?.message?.ifBlank { null }
                ?: errorBody?.error?.ifBlank { null }
                ?: "Login failed (HTTP ${response.status.value})"
            if (response.status.value == 403) {
                throw AccountExpiredException(msg)
            }
            throw Exception(msg)
        }
        return response.body()
    }

    /** Register FCM device token with the backend for push notifications. */
    suspend fun registerFcmToken(token: String, deviceId: String) {
        try {
            client.post("/api/v1/credential/devices/register") {
                contentType(ContentType.Application.Json)
                setBody(FcmTokenRequest(token = token, deviceId = deviceId, platform = "android"))
            }
        } catch (e: Exception) {
            Log.w("AuthApi", "Failed to register FCM token: ${e.message}")
        }
    }

    suspend fun fetchActiveDomains(): ApiResponse<List<AppDomainDto>> {
        val response = client.get("/api/v1/public/domains")
        if (response.status.value !in 200..299) {
            throw Exception("Failed to fetch domains (HTTP ${response.status.value})")
        }
        return response.body()
    }

    suspend fun fetchI18nConfig(): ApiResponse<I18nConfigDto> {
        val response = client.get("/api/v1/public/i18n")
        if (response.status.value !in 200..299) {
            throw Exception("Failed to fetch i18n config (HTTP ${response.status.value})")
        }
        return response.body()
    }
}

@Serializable
data class ErrorResponse(
    val statusCode: Int = 0,
    val message: String = "",
    val error: String = "",
)

@Serializable
data class RefreshRequest(
    val refreshToken: String,
)

@Serializable
data class FcmTokenRequest(
    val token: String,
    val deviceId: String,
    val platform: String,
)
