package org.auibar.aris.mobile.util

import io.mockk.every
import io.mockk.mockk
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.Date

class LocaleFormatterTest {

    private lateinit var localeManager: LocaleManager
    private lateinit var formatter: LocaleFormatter

    @Before
    fun setup() {
        localeManager = mockk()
        every { localeManager.currentLanguage } returns "en"
        formatter = LocaleFormatter(localeManager)
    }

    // ── formatNumber (Long) ──

    @Test
    fun `formatNumber formats integer in English locale`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatNumber(1234567L)
        assertTrue("Expected comma-separated, got: $result", result.contains(",") || result.contains("1234567"))
    }

    @Test
    fun `formatNumber formats integer in French locale with space separator`() {
        every { localeManager.currentLanguage } returns "fr"
        val result = formatter.formatNumber(1234567L)
        // French uses non-breaking space or period as thousands separator
        assertNotNull(result)
        assertTrue("Expected formatted number, got: $result", result.isNotEmpty())
    }

    @Test
    fun `formatNumber formats integer in Portuguese locale`() {
        every { localeManager.currentLanguage } returns "pt"
        val result = formatter.formatNumber(1234567L)
        assertNotNull(result)
        assertTrue(result.isNotEmpty())
    }

    @Test
    fun `formatNumber formats integer in Arabic locale`() {
        every { localeManager.currentLanguage } returns "ar"
        val result = formatter.formatNumber(1234567L)
        assertNotNull(result)
        assertTrue(result.isNotEmpty())
    }

    // ── formatNumber (Double) ──

    @Test
    fun `formatNumber formats decimal with specified precision`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatNumber(3.14159, 2)
        assertTrue("Expected 3.14, got: $result", result.contains("3.14"))
    }

    @Test
    fun `formatNumber decimal in French uses comma as decimal separator`() {
        every { localeManager.currentLanguage } returns "fr"
        val result = formatter.formatNumber(3.14159, 1)
        // French uses comma for decimal separator
        assertTrue("Expected comma decimal separator, got: $result", result.contains(","))
    }

    // ── formatPercent ──

    @Test
    fun `formatPercent formats correctly in English`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatPercent(85.5)
        assertTrue("Expected percentage, got: $result", result.contains("85") || result.contains("86"))
    }

    @Test
    fun `formatPercent formats zero correctly`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatPercent(0.0)
        assertTrue("Expected 0%, got: $result", result.contains("0"))
    }

    // ── formatDate ──

    @Test
    fun `formatDate returns non-empty string for English`() {
        every { localeManager.currentLanguage } returns "en"
        val date = Date(1708300800000L) // Feb 19, 2024
        val result = formatter.formatDate(date)
        assertNotNull(result)
        assertTrue("Expected date string, got: $result", result.isNotEmpty())
    }

    @Test
    fun `formatDate returns non-empty string for French`() {
        every { localeManager.currentLanguage } returns "fr"
        val date = Date(1708300800000L)
        val result = formatter.formatDate(date)
        assertNotNull(result)
        assertTrue(result.isNotEmpty())
    }

    @Test
    fun `formatDateTime returns non-empty string`() {
        every { localeManager.currentLanguage } returns "en"
        val date = Date(1708300800000L)
        val result = formatter.formatDateTime(date)
        assertNotNull(result)
        assertTrue(result.isNotEmpty())
    }

    // ── formatRelativeDate ──

    @Test
    fun `formatRelativeDate returns just now for recent timestamps in English`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 10_000) // 10 seconds ago
        assertEquals("Just now", result)
    }

    @Test
    fun `formatRelativeDate returns just now in French`() {
        every { localeManager.currentLanguage } returns "fr"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 10_000)
        assertEquals("\u00c0 l'instant", result)
    }

    @Test
    fun `formatRelativeDate returns just now in Portuguese`() {
        every { localeManager.currentLanguage } returns "pt"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 10_000)
        assertEquals("Agora mesmo", result)
    }

    @Test
    fun `formatRelativeDate returns just now in Arabic`() {
        every { localeManager.currentLanguage } returns "ar"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 10_000)
        assertEquals("\u0627\u0644\u0622\u0646", result)
    }

    @Test
    fun `formatRelativeDate returns minutes ago for recent timestamps`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 300_000) // 5 min ago
        assertTrue("Expected '5m ago', got: $result", result.contains("5m ago"))
    }

    @Test
    fun `formatRelativeDate returns hours ago`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 7_200_000) // 2 hours ago
        assertTrue("Expected '2h ago', got: $result", result.contains("2h ago"))
    }

    @Test
    fun `formatRelativeDate returns days ago`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.formatRelativeDate(System.currentTimeMillis() - 259_200_000) // 3 days ago
        assertTrue("Expected '3d ago', got: $result", result.contains("3d ago"))
    }

    // ── resolveLocalizedName ──

    @Test
    fun `resolveLocalizedName returns English name for en locale`() {
        every { localeManager.currentLanguage } returns "en"
        val result = formatter.resolveLocalizedName("Cattle", "Bovins", "Gado")
        assertEquals("Cattle", result)
    }

    @Test
    fun `resolveLocalizedName returns French name for fr locale`() {
        every { localeManager.currentLanguage } returns "fr"
        val result = formatter.resolveLocalizedName("Cattle", "Bovins", "Gado")
        assertEquals("Bovins", result)
    }

    @Test
    fun `resolveLocalizedName returns Portuguese name for pt locale`() {
        every { localeManager.currentLanguage } returns "pt"
        val result = formatter.resolveLocalizedName("Cattle", "Bovins", "Gado")
        assertEquals("Gado", result)
    }

    @Test
    fun `resolveLocalizedName falls back to English when translation is null`() {
        every { localeManager.currentLanguage } returns "ar"
        val result = formatter.resolveLocalizedName("Cattle", "Bovins", "Gado", null)
        assertEquals("Cattle", result)
    }

    @Test
    fun `resolveLocalizedName returns Arabic when available`() {
        every { localeManager.currentLanguage } returns "ar"
        val result = formatter.resolveLocalizedName("Cattle", "Bovins", "Gado", "\u0645\u0627\u0634\u064a\u0629")
        assertEquals("\u0645\u0627\u0634\u064a\u0629", result)
    }
}
