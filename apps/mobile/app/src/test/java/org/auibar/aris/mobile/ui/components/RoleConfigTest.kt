package org.auibar.aris.mobile.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RoleConfigTest {

    // ── backendToMobileKey ──────────────────────────────────────────

    @Test
    fun `backendToMobileKey maps animal-health to health`() {
        assertEquals("health", RoleConfig.backendToMobileKey("animal-health"))
    }

    @Test
    fun `backendToMobileKey maps livestock-prod to livestock`() {
        assertEquals("livestock", RoleConfig.backendToMobileKey("livestock-prod"))
    }

    @Test
    fun `backendToMobileKey maps trade-sps to trade`() {
        assertEquals("trade", RoleConfig.backendToMobileKey("trade-sps"))
    }

    @Test
    fun `backendToMobileKey maps climate-env to climate`() {
        assertEquals("climate", RoleConfig.backendToMobileKey("climate-env"))
    }

    @Test
    fun `backendToMobileKey maps knowledge-hub to knowledge`() {
        assertEquals("knowledge", RoleConfig.backendToMobileKey("knowledge-hub"))
    }

    @Test
    fun `backendToMobileKey passes through fisheries unchanged`() {
        assertEquals("fisheries", RoleConfig.backendToMobileKey("fisheries"))
    }

    @Test
    fun `backendToMobileKey passes through wildlife unchanged`() {
        assertEquals("wildlife", RoleConfig.backendToMobileKey("wildlife"))
    }

    @Test
    fun `backendToMobileKey passes through apiculture unchanged`() {
        assertEquals("apiculture", RoleConfig.backendToMobileKey("apiculture"))
    }

    @Test
    fun `backendToMobileKey passes through governance unchanged`() {
        assertEquals("governance", RoleConfig.backendToMobileKey("governance"))
    }

    // ── mobileToBackendKey ─────────────────────────────────────────

    @Test
    fun `mobileToBackendKey maps health to animal-health`() {
        assertEquals("animal-health", RoleConfig.mobileToBackendKey("health"))
    }

    @Test
    fun `mobileToBackendKey maps livestock to livestock-prod`() {
        assertEquals("livestock-prod", RoleConfig.mobileToBackendKey("livestock"))
    }

    @Test
    fun `mobileToBackendKey maps trade to trade-sps`() {
        assertEquals("trade-sps", RoleConfig.mobileToBackendKey("trade"))
    }

    @Test
    fun `mobileToBackendKey maps climate to climate-env`() {
        assertEquals("climate-env", RoleConfig.mobileToBackendKey("climate"))
    }

    @Test
    fun `mobileToBackendKey maps knowledge to knowledge-hub`() {
        assertEquals("knowledge-hub", RoleConfig.mobileToBackendKey("knowledge"))
    }

    @Test
    fun `mobileToBackendKey passes through fisheries unchanged`() {
        assertEquals("fisheries", RoleConfig.mobileToBackendKey("fisheries"))
    }

    @Test
    fun `mobileToBackendKey passes through wildlife unchanged`() {
        assertEquals("wildlife", RoleConfig.mobileToBackendKey("wildlife"))
    }

    @Test
    fun `mobileToBackendKey passes through apiculture unchanged`() {
        assertEquals("apiculture", RoleConfig.mobileToBackendKey("apiculture"))
    }

    @Test
    fun `mobileToBackendKey passes through governance unchanged`() {
        assertEquals("governance", RoleConfig.mobileToBackendKey("governance"))
    }

    // ── bidirectional round-trip ────────────────────────────────────

    @Test
    fun `backendToMobile then mobileToBackend round-trips correctly`() {
        val backendCodes = listOf(
            "animal-health", "livestock-prod", "trade-sps",
            "climate-env", "knowledge-hub",
            "fisheries", "wildlife", "apiculture", "governance",
        )
        for (code in backendCodes) {
            val mobile = RoleConfig.backendToMobileKey(code)
            val backAgain = RoleConfig.mobileToBackendKey(mobile)
            assertEquals("Round-trip failed for $code", code, backAgain)
        }
    }

    @Test
    fun `mobileToBackend then backendToMobile round-trips correctly`() {
        val mobileCodes = listOf(
            "health", "livestock", "trade", "climate", "knowledge",
            "fisheries", "wildlife", "apiculture", "governance",
        )
        for (key in mobileCodes) {
            val backend = RoleConfig.mobileToBackendKey(key)
            val backAgain = RoleConfig.backendToMobileKey(backend)
            assertEquals("Round-trip failed for $key", key, backAgain)
        }
    }

    // ── labelFor ────────────────────────────────────────────────────

    @Test
    fun `labelFor returns known role labels`() {
        assertEquals("Super Admin", RoleConfig.labelFor("SUPER_ADMIN"))
        assertEquals("Field Agent", RoleConfig.labelFor("FIELD_AGENT"))
        assertEquals("National Admin", RoleConfig.labelFor("NATIONAL_ADMIN"))
    }

    @Test
    fun `labelFor returns Unknown for null role`() {
        assertEquals("Unknown", RoleConfig.labelFor(null))
    }

    @Test
    fun `labelFor formats unknown role with underscores`() {
        assertEquals("Some new role", RoleConfig.labelFor("SOME_NEW_ROLE"))
    }

    // ── tenantLevelLabel ────────────────────────────────────────────

    @Test
    fun `tenantLevelLabel returns known levels`() {
        assertEquals("Continental (AU-IBAR)", RoleConfig.tenantLevelLabel("CONTINENTAL"))
        assertEquals("Regional Economic Community", RoleConfig.tenantLevelLabel("REC"))
        assertEquals("Member State", RoleConfig.tenantLevelLabel("MEMBER_STATE"))
    }

    @Test
    fun `tenantLevelLabel returns empty for null`() {
        assertEquals("", RoleConfig.tenantLevelLabel(null))
    }

    // ── visibleDomains (role-only) ──────────────────────────────────

    @Test
    fun `SUPER_ADMIN sees all domains`() {
        val domains = RoleConfig.visibleDomains("SUPER_ADMIN")
        assertEquals(arisDomains.size, domains.size)
    }

    @Test
    fun `FIELD_AGENT sees only health`() {
        val domains = RoleConfig.visibleDomains("FIELD_AGENT")
        assertEquals(1, domains.size)
        assertEquals("health", domains[0].key)
    }

    @Test
    fun `WAHIS_FOCAL_POINT sees 5 domains`() {
        val domains = RoleConfig.visibleDomains("WAHIS_FOCAL_POINT")
        assertEquals(5, domains.size)
        val keys = domains.map { it.key }.toSet()
        assertTrue(keys.contains("health"))
        assertTrue(keys.contains("livestock"))
        assertTrue(keys.contains("fisheries"))
        assertTrue(keys.contains("wildlife"))
        assertTrue(keys.contains("trade"))
    }

    // ── visibleDomains (role + user domains) ────────────────────────

    @Test
    fun `NATIONAL_ADMIN with assigned domains only sees assigned`() {
        val domains = RoleConfig.visibleDomains(
            "NATIONAL_ADMIN",
            listOf("animal-health", "fisheries"),
        )
        assertEquals(2, domains.size)
        val keys = domains.map { it.key }.toSet()
        assertTrue(keys.contains("health"))
        assertTrue(keys.contains("fisheries"))
    }

    @Test
    fun `FIELD_AGENT with assigned domains intersects with role restriction`() {
        // FIELD_AGENT only sees "health", even if assigned fisheries
        val domains = RoleConfig.visibleDomains(
            "FIELD_AGENT",
            listOf("animal-health", "fisheries"),
        )
        assertEquals(1, domains.size)
        assertEquals("health", domains[0].key)
    }

    @Test
    fun `empty user domains falls back to role-only visibility`() {
        val domains = RoleConfig.visibleDomains("NATIONAL_ADMIN", emptyList())
        assertEquals(arisDomains.size, domains.size)
    }

    // ── canCreate / canReport ───────────────────────────────────────

    @Test
    fun `FIELD_AGENT can create submissions`() {
        assertTrue(RoleConfig.canCreate("FIELD_AGENT"))
    }

    @Test
    fun `ANALYST cannot create submissions`() {
        assertFalse(RoleConfig.canCreate("ANALYST"))
    }

    @Test
    fun `ANALYST can see reports`() {
        assertTrue(RoleConfig.canReport("ANALYST"))
    }

    @Test
    fun `FIELD_AGENT cannot see reports`() {
        assertFalse(RoleConfig.canReport("FIELD_AGENT"))
    }

    @Test
    fun `null role cannot create or report`() {
        assertFalse(RoleConfig.canCreate(null))
        assertFalse(RoleConfig.canReport(null))
    }
}
