package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.websocket.WebSocketManager
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

sealed class LoginResult {
    object Success : LoginResult()
    object MfaRequired : LoginResult()
    data class Error(val message: String) : LoginResult()
}

class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
    private val webSocketManager: WebSocketManager,
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
        } catch (e: Exception) {
            LoginResult.Error(e.message ?: "Login failed")
        }
    }

    suspend fun verifyMfa(email: String, password: String, totpCode: String): LoginResult {
        return try {
            val response = authApi.login(email, password, totpCode)
            val loginData = response.data
            saveSession(loginData)
        } catch (e: Exception) {
            LoginResult.Error(e.message ?: "Invalid verification code")
        }
    }

    private fun saveSession(loginData: org.auibar.aris.mobile.data.remote.dto.LoginResponse): LoginResult {
        val user = loginData.user
            ?: return LoginResult.Error("Login failed: no user data")
        tokenManager.accessToken = loginData.accessToken
        tokenManager.refreshToken = loginData.refreshToken
        tokenManager.userId = user.id
        tokenManager.userRole = user.role
        tokenManager.tenantId = user.tenantId
        tokenManager.tenantLevel = user.tenantLevel
        tokenManager.userFullName = "${user.firstName} ${user.lastName}".trim()
        tokenManager.userEmail = user.email
        return LoginResult.Success
    }

    fun logout() {
        webSocketManager.disconnect()
        tokenManager.clear()
    }
}
