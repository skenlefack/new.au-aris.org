package org.auibar.aris.mobile.util

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests version comparison logic used by AppUpdateManager.
 * We test the compareVersions function independently.
 */
class AppUpdateManagerTest {

    // Helper: same logic as in AppUpdateManager
    private fun compareVersions(current: List<Int>, other: List<Int>): Int {
        val maxLen = maxOf(current.size, other.size)
        for (i in 0 until maxLen) {
            val c = current.getOrElse(i) { 0 }
            val o = other.getOrElse(i) { 0 }
            if (c != o) return c.compareTo(o)
        }
        return 0
    }

    private fun parseVersion(version: String): List<Int> {
        return version.replace("-alpha", "").replace("-beta", "")
            .split(".").mapNotNull { it.toIntOrNull() }
    }

    @Test
    fun `same version returns 0`() {
        assertEquals(0, compareVersions(parseVersion("0.1.0"), parseVersion("0.1.0")))
    }

    @Test
    fun `older version returns negative`() {
        assertTrue(compareVersions(parseVersion("0.1.0"), parseVersion("0.2.0")) < 0)
    }

    @Test
    fun `newer version returns positive`() {
        assertTrue(compareVersions(parseVersion("1.0.0"), parseVersion("0.9.9")) > 0)
    }

    @Test
    fun `patch version difference detected`() {
        assertTrue(compareVersions(parseVersion("1.0.0"), parseVersion("1.0.1")) < 0)
    }

    @Test
    fun `major version difference takes precedence`() {
        assertTrue(compareVersions(parseVersion("0.9.9"), parseVersion("1.0.0")) < 0)
    }

    @Test
    fun `alpha suffix is stripped for comparison`() {
        assertEquals(0, compareVersions(parseVersion("0.1.0-alpha"), parseVersion("0.1.0")))
    }

    @Test
    fun `different length versions compared correctly`() {
        assertTrue(compareVersions(parseVersion("1.0"), parseVersion("1.0.1")) < 0)
    }

    @Test
    fun `version 0_1_0 is older than 0_1_1`() {
        assertTrue(compareVersions(parseVersion("0.1.0"), parseVersion("0.1.1")) < 0)
    }

    @Test
    fun `version 2_0_0 is newer than 1_9_9`() {
        assertTrue(compareVersions(parseVersion("2.0.0"), parseVersion("1.9.9")) > 0)
    }
}
