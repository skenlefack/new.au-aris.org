package org.auibar.aris.mobile.util

import android.content.SharedPreferences
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for TokenManager helper methods.
 * We mock SharedPreferences to test domain/locale parsing and clear logic.
 */
class TokenManagerTest {

    // Since TokenManager uses EncryptedSharedPreferences (hard to instantiate in unit tests),
    // we test the public utility methods via mockk(relaxed = true).

    private lateinit var tokenManager: TokenManager

    @Before
    fun setup() {
        tokenManager = mockk(relaxed = true)
    }

    // ── getUserDomainList ────────────────────────────────────────────

    @Test
    fun `getUserDomainList parses comma-separated domains`() {
        // Use real implementation for this test
        every { tokenManager.userDomains } returns "animal-health,fisheries,wildlife"
        every { tokenManager.getUserDomainList() } answers { callOriginal() }

        val result = tokenManager.getUserDomainList()

        assertEquals(3, result.size)
        assertEquals("animal-health", result[0])
        assertEquals("fisheries", result[1])
        assertEquals("wildlife", result[2])
    }

    @Test
    fun `getUserDomainList returns empty list for null`() {
        every { tokenManager.userDomains } returns null
        every { tokenManager.getUserDomainList() } answers { callOriginal() }

        assertTrue(tokenManager.getUserDomainList().isEmpty())
    }

    @Test
    fun `getUserDomainList filters blank entries`() {
        every { tokenManager.userDomains } returns "health,,fisheries,"
        every { tokenManager.getUserDomainList() } answers { callOriginal() }

        val result = tokenManager.getUserDomainList()
        assertEquals(2, result.size)
    }

    // ── getActiveDomainCodes ────────────────────────────────────────

    @Test
    fun `getActiveDomainCodes parses comma-separated codes`() {
        every { tokenManager.activeDomains } returns "health,livestock,fisheries"
        every { tokenManager.getActiveDomainCodes() } answers { callOriginal() }

        val result = tokenManager.getActiveDomainCodes()
        assertEquals(3, result.size)
    }

    @Test
    fun `getActiveDomainCodes returns empty for null`() {
        every { tokenManager.activeDomains } returns null
        every { tokenManager.getActiveDomainCodes() } answers { callOriginal() }

        assertTrue(tokenManager.getActiveDomainCodes().isEmpty())
    }

    // ── getActiveLocaleList ─────────────────────────────────────────

    @Test
    fun `getActiveLocaleList parses locale codes`() {
        every { tokenManager.activeLocales } returns "en,fr,pt"
        every { tokenManager.getActiveLocaleList() } answers { callOriginal() }

        val result = tokenManager.getActiveLocaleList()
        assertEquals(3, result.size)
        assertEquals("en", result[0])
        assertEquals("fr", result[1])
        assertEquals("pt", result[2])
    }

    // ── isLoggedIn ──────────────────────────────────────────────────

    @Test
    fun `isLoggedIn returns true when access token present`() {
        every { tokenManager.accessToken } returns "some-jwt-token"
        every { tokenManager.isLoggedIn } answers { callOriginal() }

        assertTrue(tokenManager.isLoggedIn)
    }

    @Test
    fun `isLoggedIn returns false when no access token`() {
        every { tokenManager.accessToken } returns null
        every { tokenManager.isLoggedIn } answers { callOriginal() }

        assertFalse(tokenManager.isLoggedIn)
    }

    // ── ServerEnvironment ───────────────────────────────────────────

    @Test
    fun `ServerEnvironment fromName returns correct enum`() {
        assertEquals(ServerEnvironment.PRODUCTION, ServerEnvironment.fromName("PRODUCTION"))
        assertEquals(ServerEnvironment.STAGING, ServerEnvironment.fromName("STAGING"))
        assertEquals(ServerEnvironment.PRODUCTION_OFFICE, ServerEnvironment.fromName("PRODUCTION_OFFICE"))
    }

    @Test
    fun `ServerEnvironment fromName defaults to PRODUCTION for unknown`() {
        assertEquals(ServerEnvironment.PRODUCTION, ServerEnvironment.fromName("UNKNOWN"))
    }

    @Test
    fun `ServerEnvironment isInternalIp detects internal IPs`() {
        assertTrue(ServerEnvironment.PRODUCTION_OFFICE.isInternalIp)
        assertFalse(ServerEnvironment.PRODUCTION.isInternalIp)
        assertFalse(ServerEnvironment.STAGING.isInternalIp)
    }
}
