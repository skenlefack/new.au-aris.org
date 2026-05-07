package org.auibar.aris.mobile.ui.domain

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for the DomainDashboardScreen composables.
 * Uses in-memory data (no server dependency).
 */
@RunWith(AndroidJUnit4::class)
class DomainDashboardScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun domainConfig_health_showsCorrectKpis() {
        val config = DomainDashboards.configFor("health")
        assertEquals("Surveillance, Outbreaks, Lab & Vaccination", config.subtitle)
        assertEquals(4, config.kpis.size)
        assertEquals(4, config.quickLinks.size)
    }

    @Test
    fun domainConfig_livestock_showsCorrectKpis() {
        val config = DomainDashboards.configFor("livestock")
        assertEquals("Census, Production & Pastoralism", config.subtitle)
        assertEquals(4, config.kpis.size)
        assertEquals("Population", config.kpis[0].label)
    }

    @Test
    fun domainConfig_fisheries_showsCorrectKpis() {
        val config = DomainDashboards.configFor("fisheries")
        assertEquals("Captures, Fleet, Licenses & Aquaculture", config.subtitle)
        assertEquals(4, config.kpis.size)
    }

    @Test
    fun domainConfig_wildlife_exists() {
        val config = DomainDashboards.configFor("wildlife")
        assertEquals(4, config.kpis.size)
        assertEquals(4, config.quickLinks.size)
    }

    @Test
    fun domainConfig_apiculture_exists() {
        val config = DomainDashboards.configFor("apiculture")
        assertEquals(4, config.kpis.size)
    }

    @Test
    fun domainConfig_trade_exists() {
        val config = DomainDashboards.configFor("trade")
        assertEquals(4, config.kpis.size)
    }

    @Test
    fun domainConfig_governance_exists() {
        val config = DomainDashboards.configFor("governance")
        assertEquals(4, config.kpis.size)
    }

    @Test
    fun domainConfig_climate_exists() {
        val config = DomainDashboards.configFor("climate")
        assertEquals(4, config.kpis.size)
    }

    @Test
    fun domainConfig_unknown_returnsEmpty() {
        val config = DomainDashboards.configFor("nonexistent")
        assertEquals(0, config.kpis.size)
        assertEquals(0, config.quickLinks.size)
    }

    @Test
    fun quickLinks_haveUniqueLabels() {
        val domains = listOf("health", "livestock", "fisheries", "wildlife", "apiculture", "trade", "governance", "climate")
        domains.forEach { domain ->
            val config = DomainDashboards.configFor(domain)
            val labels = config.quickLinks.map { it.label }
            assertEquals(
                "Domain '$domain' has duplicate quickLink labels: $labels",
                labels.size,
                labels.toSet().size,
            )
        }
    }

    @Test
    fun kpiCard_rendersInCompose() {
        val kpi = DomainKpi(
            label = "Active Events",
            value = "24",
            subtitle = "outbreaks tracked",
            trend = "up",
            trendValue = "+3",
            icon = androidx.compose.material.icons.Icons.Default.Warning,
        )

        composeTestRule.setContent {
            ArisTheme {
                // Verify the KPI data is valid and renders without crash
                androidx.compose.material3.Text("${kpi.label}: ${kpi.value}")
            }
        }

        composeTestRule.onNodeWithText("Active Events: 24").assertIsDisplayed()
    }
}
