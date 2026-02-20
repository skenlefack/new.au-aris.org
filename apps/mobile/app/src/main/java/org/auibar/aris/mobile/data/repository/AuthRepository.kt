package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
) {
    val isLoggedIn: Boolean
        get() = tokenManager.isLoggedIn

    suspend fun login(email: String, password: String): Result<Unit> {
        return try {
            val response = authApi.login(email, password)
            val loginData = response.data
            tokenManager.accessToken = loginData.accessToken
            tokenManager.refreshToken = loginData.refreshToken
            tokenManager.userId = loginData.user.id
            tokenManager.userRole = loginData.user.role
            tokenManager.tenantId = loginData.user.tenantId
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        tokenManager.clear()
    }
}
