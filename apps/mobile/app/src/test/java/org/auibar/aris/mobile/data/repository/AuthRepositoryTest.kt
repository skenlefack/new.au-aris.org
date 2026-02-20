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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
        repository = AuthRepository(authApi, tokenManager)
    }

    @Test
    fun `login success stores tokens`() = runTest {
        val loginResponse = LoginResponse(
            accessToken = "access-token-123",
            refreshToken = "refresh-token-456",
            user = UserDto(
                id = "user-1",
                email = "agent@test.org",
                fullName = "Test Agent",
                role = "FIELD_AGENT",
                tenantId = "tenant-ke",
            ),
        )
        coEvery { authApi.login(any(), any()) } returns ApiResponse(data = loginResponse)

        val result = repository.login("agent@test.org", "password123")

        assertTrue(result.isSuccess)
        verify { tokenManager.accessToken = "access-token-123" }
        verify { tokenManager.refreshToken = "refresh-token-456" }
        verify { tokenManager.userId = "user-1" }
        verify { tokenManager.userRole = "FIELD_AGENT" }
        verify { tokenManager.tenantId = "tenant-ke" }
    }

    @Test
    fun `login failure returns error`() = runTest {
        coEvery { authApi.login(any(), any()) } throws RuntimeException("Invalid credentials")

        val result = repository.login("bad@test.org", "wrong")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message == "Invalid credentials")
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
