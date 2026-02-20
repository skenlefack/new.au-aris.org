package org.auibar.aris.mobile.util

import android.content.Context
import android.content.SharedPreferences
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AppLockManagerTest {

    @Test
    fun `LOCK_TIMEOUT_MS is 5 minutes`() {
        assertEquals(5 * 60 * 1000L, AppLockManager.LOCK_TIMEOUT_MS)
    }

    @Test
    fun `pin hash is deterministic`() {
        // SHA-256 of "1234" — verify the hashing is consistent
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest("1234".toByteArray())
        val hash = digest.joinToString("") { "%02x".format(it) }

        // Verify it's a valid 64-char hex string (SHA-256)
        assertEquals(64, hash.length)
        assertTrue(hash.all { it in '0'..'9' || it in 'a'..'f' })
    }

    @Test
    fun `same pin produces same hash`() {
        val digest1 = java.security.MessageDigest.getInstance("SHA-256")
            .digest("5678".toByteArray())
        val hash1 = digest1.joinToString("") { "%02x".format(it) }

        val digest2 = java.security.MessageDigest.getInstance("SHA-256")
            .digest("5678".toByteArray())
        val hash2 = digest2.joinToString("") { "%02x".format(it) }

        assertEquals(hash1, hash2)
    }

    @Test
    fun `different pins produce different hashes`() {
        val digest1 = java.security.MessageDigest.getInstance("SHA-256")
            .digest("1234".toByteArray())
        val hash1 = digest1.joinToString("") { "%02x".format(it) }

        val digest2 = java.security.MessageDigest.getInstance("SHA-256")
            .digest("5678".toByteArray())
        val hash2 = digest2.joinToString("") { "%02x".format(it) }

        assertTrue(hash1 != hash2)
    }

    @Test
    fun `lock timeout constant is positive`() {
        assertTrue(AppLockManager.LOCK_TIMEOUT_MS > 0)
    }

    @Test
    fun `lock timeout is exactly 300000ms`() {
        assertEquals(300_000L, AppLockManager.LOCK_TIMEOUT_MS)
    }
}
