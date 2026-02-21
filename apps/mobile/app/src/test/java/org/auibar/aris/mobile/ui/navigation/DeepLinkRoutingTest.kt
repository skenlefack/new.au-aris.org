package org.auibar.aris.mobile.ui.navigation

import android.net.Uri
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class DeepLinkRoutingTest {

    @Before
    fun setup() {
        mockkStatic(Uri::class)
    }

    @After
    fun teardown() {
        unmockkStatic(Uri::class)
    }

    private fun mockUri(scheme: String?, host: String?, pathSegments: List<String>): Uri {
        val uri = mockk<Uri>()
        every { uri.scheme } returns scheme
        every { uri.host } returns host
        every { uri.pathSegments } returns pathSegments
        every { uri.toString() } returns "$scheme://$host/${pathSegments.joinToString("/")}"
        return uri
    }

    // ── Route resolution helpers ──

    private fun resolveDeepLink(uri: Uri): String? {
        val scheme = uri.scheme ?: return null
        if (scheme != "aris") return null

        val host = uri.host ?: return null
        val segments = uri.pathSegments

        return when (host) {
            "campaign" -> {
                val id = segments.firstOrNull() ?: return null
                ArisRoutes.campaignDetail(id)
            }
            "submission" -> {
                val id = segments.firstOrNull() ?: return null
                "submission/$id"
            }
            "notifications" -> ArisRoutes.NOTIFICATIONS
            else -> null
        }
    }

    // ── Campaign deep links ──

    @Test
    fun `campaign deep link resolves to campaign detail route`() {
        val uri = mockUri("aris", "campaign", listOf("abc-123"))
        val route = resolveDeepLink(uri)
        assertEquals("campaign/abc-123", route)
    }

    @Test
    fun `campaign deep link with UUID resolves correctly`() {
        val uri = mockUri("aris", "campaign", listOf("550e8400-e29b-41d4-a716-446655440000"))
        val route = resolveDeepLink(uri)
        assertEquals("campaign/550e8400-e29b-41d4-a716-446655440000", route)
    }

    @Test
    fun `campaign deep link without ID returns null`() {
        val uri = mockUri("aris", "campaign", emptyList())
        val route = resolveDeepLink(uri)
        assertNull(route)
    }

    // ── Submission deep links ──

    @Test
    fun `submission deep link resolves to submission detail route`() {
        val uri = mockUri("aris", "submission", listOf("sub-456"))
        val route = resolveDeepLink(uri)
        assertEquals("submission/sub-456", route)
    }

    @Test
    fun `submission deep link without ID returns null`() {
        val uri = mockUri("aris", "submission", emptyList())
        val route = resolveDeepLink(uri)
        assertNull(route)
    }

    // ── Notifications deep link ──

    @Test
    fun `notifications deep link resolves to notifications route`() {
        val uri = mockUri("aris", "notifications", emptyList())
        val route = resolveDeepLink(uri)
        assertEquals("notifications", route)
    }

    // ── Invalid deep links ──

    @Test
    fun `unknown scheme returns null`() {
        val uri = mockUri("https", "campaign", listOf("abc"))
        val route = resolveDeepLink(uri)
        assertNull(route)
    }

    @Test
    fun `unknown host returns null`() {
        val uri = mockUri("aris", "unknown", listOf("abc"))
        val route = resolveDeepLink(uri)
        assertNull(route)
    }

    @Test
    fun `null scheme returns null`() {
        val uri = mockUri(null, "campaign", listOf("abc"))
        val route = resolveDeepLink(uri)
        assertNull(route)
    }

    // ── ArisRoutes helpers ──

    @Test
    fun `ArisRoutes campaignDetail generates correct route`() {
        assertEquals("campaign/test-id", ArisRoutes.campaignDetail("test-id"))
    }

    @Test
    fun `ArisRoutes formFill generates correct route`() {
        assertEquals("form/test-id", ArisRoutes.formFill("test-id"))
    }

    @Test
    fun `ArisRoutes photoGallery generates correct route`() {
        assertEquals("photo-gallery/sub-id", ArisRoutes.photoGallery("sub-id"))
    }

    @Test
    fun `ArisRoutes livestockCensus generates correct route`() {
        assertEquals("livestock-census/camp-id", ArisRoutes.livestockCensus("camp-id"))
    }

    @Test
    fun `ArisRoutes productionRecord generates correct route`() {
        assertEquals("production-record/camp-id", ArisRoutes.productionRecord("camp-id"))
    }
}
