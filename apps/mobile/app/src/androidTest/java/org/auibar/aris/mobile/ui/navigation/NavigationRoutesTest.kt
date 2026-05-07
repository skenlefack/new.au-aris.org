package org.auibar.aris.mobile.ui.navigation

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Tests for navigation route generation.
 * Verifies all route helpers produce valid URI strings.
 */
@RunWith(AndroidJUnit4::class)
class NavigationRoutesTest {

    @Test
    fun domainDashboard_generatesCorrectRoute() {
        assertEquals("domain/health", ArisRoutes.domainDashboard("health"))
        assertEquals("domain/livestock", ArisRoutes.domainDashboard("livestock"))
        assertEquals("domain/fisheries", ArisRoutes.domainDashboard("fisheries"))
    }

    @Test
    fun campaignDetail_generatesCorrectRoute() {
        assertEquals("campaign/abc-123", ArisRoutes.campaignDetail("abc-123"))
    }

    @Test
    fun formFill_withTemplateId() {
        assertEquals("form/c1?templateId=t1", ArisRoutes.formFill("c1", "t1"))
    }

    @Test
    fun formFill_withoutTemplateId() {
        assertEquals("form/c1", ArisRoutes.formFill("c1"))
    }

    @Test
    fun domainFormRoutes_allGenerate() {
        val routes = listOf(
            ArisRoutes.outbreakReport("new"),
            ArisRoutes.surveillanceEvent("new"),
            ArisRoutes.captureRecord("new"),
            ArisRoutes.aquacultureRecord("new"),
            ArisRoutes.tradeFlow("new"),
            ArisRoutes.spsCertificate("new"),
            ArisRoutes.legalFramework("new"),
            ArisRoutes.vetCapacity("new"),
            ArisRoutes.livestockCensus("new"),
            ArisRoutes.productionRecord("new"),
            ArisRoutes.apiaryRecord("new"),
            ArisRoutes.colonyHealth("new"),
            ArisRoutes.wildlifeObservation("new"),
            ArisRoutes.hwcReport("new"),
            ArisRoutes.waterStress("new"),
            ArisRoutes.rangeland("new"),
        )

        assertEquals(16, routes.size)
        routes.forEach { route ->
            assertTrue("Route should contain 'new': $route", route.contains("new"))
            assertTrue("Route should not be empty", route.isNotBlank())
        }
    }

    @Test
    fun routeConstants_allDefined() {
        val constants = listOf(
            ArisRoutes.SPLASH,
            ArisRoutes.LOGIN,
            ArisRoutes.HOME,
            ArisRoutes.DASHBOARD,
            ArisRoutes.CAMPAIGNS,
            ArisRoutes.SUBMISSIONS,
            ArisRoutes.NOTIFICATIONS,
            ArisRoutes.SETTINGS,
            ArisRoutes.REPORTS,
            ArisRoutes.GPS_TRACK,
            ArisRoutes.TENANT_HIERARCHY,
            ArisRoutes.APP_LOCK,
            ArisRoutes.SET_PIN,
            ArisRoutes.PAID_DASHBOARD,
            ArisRoutes.PAID_COLLECTE,
            ArisRoutes.KNOWLEDGE_HUB,
            ArisRoutes.KNOWLEDGE_SEARCH,
            ArisRoutes.KNOWLEDGE_COURSES,
            ArisRoutes.ANALYTICS_DASHBOARD,
            ArisRoutes.TILE_DOWNLOAD,
            ArisRoutes.MESSAGES,
            ArisRoutes.COMPOSE_MESSAGE,
        )

        constants.forEach { route ->
            assertTrue("Route constant should not be empty: $route", route.isNotBlank())
        }
    }

    @Test
    fun routeConstants_domainScreens_allDefined() {
        val domainRoutes = listOf(
            ArisRoutes.OUTBREAK_REPORT,
            ArisRoutes.SURVEILLANCE_EVENT,
            ArisRoutes.CAPTURE_RECORD,
            ArisRoutes.AQUACULTURE_RECORD,
            ArisRoutes.TRADE_FLOW,
            ArisRoutes.SPS_CERTIFICATE,
            ArisRoutes.LEGAL_FRAMEWORK,
            ArisRoutes.VET_CAPACITY,
            ArisRoutes.LIVESTOCK_CENSUS,
            ArisRoutes.PRODUCTION_RECORD,
            ArisRoutes.APIARY_RECORD,
            ArisRoutes.COLONY_HEALTH,
            ArisRoutes.WILDLIFE_OBSERVATION,
            ArisRoutes.HWC_REPORT,
            ArisRoutes.WATER_STRESS,
            ArisRoutes.RANGELAND,
        )

        assertEquals("Expected 16 domain screen routes", 16, domainRoutes.size)
        domainRoutes.forEach { route ->
            assertTrue("Route should contain {campaignId}: $route", route.contains("{campaignId}"))
        }
    }
}
