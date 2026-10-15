package org.auibar.aris.mobile.data.repository

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.data.remote.api.AccountExpiredException
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.dto.AppDomainDto
import org.auibar.aris.mobile.data.remote.websocket.WebSocketManager
import org.auibar.aris.mobile.sync.MdmHeartbeatWorker
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

sealed class LoginResult {
    object Success : LoginResult()
    object MfaRequired : LoginResult()
    data class Error(val message: String) : LoginResult()
    data class AccountExpired(val message: String) : LoginResult()
}

class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
    private val webSocketManager: WebSocketManager,
    private val mdmRepository: MdmRepository,
    @ApplicationContext private val context: Context,
) {
    val isLoggedIn: Boolean
        get() = tokenManager.isLoggedIn

    suspend fun login(email: String, password: String): LoginResult {
        return try {
            val response = authApi.login(email, password)
            val loginData = response.data
            if (loginData.mfaRequired) {
                return LoginResult.MfaRequired
            }
            saveSession(loginData)
            fetchServerConfig()
            registerFcmToken()
            enrollMdmDevice()
            LoginResult.Success
        } catch (e: AccountExpiredException) {
            LoginResult.AccountExpired(e.message ?: "Account expired")
        } catch (e: Exception) {
            LoginResult.Error(e.message ?: "Login failed")
        }
    }

    suspend fun verifyMfa(email: String, password: String, totpCode: String): LoginResult {
        return try {
            val response = authApi.login(email, password, totpCode)
            val loginData = response.data
            saveSession(loginData)
            fetchServerConfig()
            registerFcmToken()
            enrollMdmDevice()
            LoginResult.Success
        } catch (e: AccountExpiredException) {
            LoginResult.AccountExpired(e.message ?: "Account expired")
        } catch (e: Exception) {
            LoginResult.Error(e.message ?: "Invalid verification code")
        }
    }

    private fun saveSession(loginData: org.auibar.aris.mobile.data.remote.dto.LoginResponse) {
        val user = loginData.user
            ?: throw Exception("Login failed: no user data")
        tokenManager.accessToken = loginData.accessToken
        tokenManager.refreshToken = loginData.refreshToken
        tokenManager.userId = user.id
        tokenManager.userRole = user.role
        tokenManager.tenantId = user.tenantId
        tokenManager.tenantLevel = user.tenantLevel
        tokenManager.userFullName = "${user.firstName} ${user.lastName}".trim()
        tokenManager.userEmail = user.email
        tokenManager.userDomains = user.domains
            .map { it.code }
            .joinToString(",")
    }

    /** Register FCM token with backend (best-effort). */
    private suspend fun registerFcmToken() {
        try {
            val token = tokenManager.fcmToken
                ?: FirebaseMessaging.getInstance().token.await()
            tokenManager.fcmToken = token
            authApi.registerFcmToken(token, tokenManager.deviceId)
            Log.d("AuthRepository", "FCM token registered")
        } catch (e: Exception) {
            Log.w("AuthRepository", "FCM token registration failed: ${e.message}")
        }
    }

    /** Fetch system-active domains and locales from server (best-effort). */
    private suspend fun fetchServerConfig() {
        try {
            val domainsResponse = authApi.fetchActiveDomains()
            val activeDomains = domainsResponse.data
                .filter { it.isActive }
                .sortedBy { it.sortOrder }
            val mobileCodes = activeDomains.map { RoleConfig.backendToMobileKey(it.code) }
            tokenManager.activeDomains = mobileCodes.joinToString(",")
            // Store full domain data for dynamic UI rendering
            tokenManager.activeDomainsJson = Json.encodeToString(activeDomains)
        } catch (e: Exception) {
            Log.w("AuthRepository", "Failed to fetch active domains: ${e.message}")
        }
        try {
            val i18nResponse = authApi.fetchI18nConfig()
            val locales = i18nResponse.data.availableLocales
            if (locales.isNotEmpty()) {
                tokenManager.activeLocales = locales.joinToString(",")
            }
        } catch (e: Exception) {
            Log.w("AuthRepository", "Failed to fetch i18n config: ${e.message}")
        }
    }

    /** Enroll device with MDM backend and schedule heartbeat worker (best-effort). */
    private suspend fun enrollMdmDevice() {
        try {
            val response = mdmRepository.enrollDevice()
            if (response != null) {
                MdmHeartbeatWorker.saveDeviceToken(context, response.deviceToken)
                MdmHeartbeatWorker.enqueue(context)
                Log.d("AuthRepository", "MDM enrolled: deviceId=${response.id}")
            } else {
                Log.w("AuthRepository", "MDM enrollment returned null — will retry on next login")
            }
        } catch (e: Exception) {
            Log.w("AuthRepository", "MDM enrollment failed: ${e.message}")
        }
    }

    fun logout() {
        MdmHeartbeatWorker.cancel(context)
        webSocketManager.disconnect()
        tokenManager.clear()
    }
}
