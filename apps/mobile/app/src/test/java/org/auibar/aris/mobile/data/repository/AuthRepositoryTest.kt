package org.auibar.aris.mobile.data.repository

import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.LoginResponse
import org.auibar.aris.mobile.data.remote.dto.UserDto
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthRepositoryTest {

    private lateinit var authApi: AuthApi
    private lateinit var tokenManager: TokenManager
    private lateinit var repository: AuthRepository

    @Before
    fun setup() {
        authApi = mockk()
        tokenManager = mockk(relaxed = true)
        repository = AuthRepository(authApi, tokenManager, mockk(relaxed = true))
    }

    @Test
    fun `login success stores tokens`() = runTest {
        val loginResponse = LoginResponse(
            accessToken = "access-token-123",
            refreshToken = "refresh-token-456",
            user = UserDto(
                id = "user-1",
                email = "agent@test.org",
                firstName = "Test",
                lastName = "Agent",
                role = "FIELD_AGENT",
                tenantId = "tenant-ke",
            ),
        )
        coEvery { authApi.login(any(), any(), isNull()) } returns ApiResponse(data = loginResponse)

        val result = repository.login("agent@test.org", "password123")

        assertTrue(result is LoginResult.Success)
        verify { tokenManager.accessToken = "access-token-123" }
        verify { tokenManager.refreshToken = "refresh-token-456" }
        verify { tokenManager.userId = "user-1" }
        verify { tokenManager.userRole = "FIELD_AGENT" }
        verify { tokenManager.tenantId = "tenant-ke" }
    }

    @Test
    fun `login failure returns error`() = runTest {
        coEvery { authApi.login(any(), any(), isNull()) } throws RuntimeException("Invalid credentials")

        val result = repository.login("bad@test.org", "wrong")

        assertTrue(result is LoginResult.Error)
        assertEquals("Invalid credentials", (result as LoginResult.Error).message)
    }

    @Test
    fun `login returns MfaRequired when server demands TOTP`() = runTest {
        val mfaResponse = LoginResponse(
            accessToken = "",
            refreshToken = "",
            mfaRequired = true,
        )
        coEvery { authApi.login(any(), any(), isNull()) } returns ApiResponse(data = mfaResponse)

        val result = repository.login("mfa@test.org", "password123")

        assertTrue(result is LoginResult.MfaRequired)
    }

    @Test
    fun `verifyMfa success stores tokens`() = runTest {
        val loginResponse = LoginResponse(
            accessToken = "mfa-access-token",
            refreshToken = "mfa-refresh-token",
            user = UserDto(
                id = "user-1",
                email = "mfa@test.org",
                firstName = "MFA",
                lastName = "User",
                role = "NATIONAL_ADMIN",
                tenantId = "tenant-ke",
            ),
        )
        coEvery { authApi.login("mfa@test.org", "password123", "123456") } returns ApiResponse(data = loginResponse)

        val result = repository.verifyMfa("mfa@test.org", "password123", "123456")

        assertTrue(result is LoginResult.Success)
        verify { tokenManager.accessToken = "mfa-access-token" }
        verify { tokenManager.refreshToken = "mfa-refresh-token" }
    }

    @Test
    fun `verifyMfa with invalid code returns error`() = runTest {
        coEvery { authApi.login(any(), any(), any()) } throws RuntimeException("Invalid TOTP code")

        val result = repository.verifyMfa("mfa@test.org", "password123", "000000")

        assertTrue(result is LoginResult.Error)
        assertEquals("Invalid TOTP code", (result as LoginResult.Error).message)
    }

    @Test
    fun `isLoggedIn delegates to tokenManager`() {
        every { tokenManager.isLoggedIn } returns true
        assertTrue(repository.isLoggedIn)

        every { tokenManager.isLoggedIn } returns false
        assertFalse(repository.isLoggedIn)
    }

    @Test
    fun `logout clears tokenManager`() {
        repository.logout()
        verify { tokenManager.clear() }
    }
}
