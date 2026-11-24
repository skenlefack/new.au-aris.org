package org.auibar.aris.mobile.ui.form.engine

import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminLocationTest {

    private fun lvl(n: Int, active: Boolean = true) =
        AdminLevelConfig(n, mapOf("en" to "L$n", "fr" to "N$n"), active)

    private val all = listOf(0, 1, 2, 3, 4, 5)

    @Test
    fun `shows only the levels configured for the country`() {
        val burundi = listOf(lvl(1), lvl(2), lvl(3), lvl(4))
        assertEquals(listOf(0, 1, 2, 3, 4), AdminLocation.visibleLevels(all, burundi))
    }

    @Test
    fun `keeps the form limit and hides inactive levels`() {
        assertEquals(listOf(0, 1, 2), AdminLocation.visibleLevels(listOf(0, 1, 2), (1..5).map { lvl(it) }))
        assertEquals(listOf(0, 1, 2, 3), AdminLocation.visibleLevels(all, listOf(lvl(1), lvl(2), lvl(3), lvl(4, false))))
    }

    @Test
    fun `keeps the form levels without configuration`() {
        assertEquals(all, AdminLocation.visibleLevels(all, null))
        assertEquals(all, AdminLocation.visibleLevels(all, emptyList()))
    }

    @Test
    fun `parses level keys`() {
        assertEquals("admin_location" to 3, AdminLocation.parseKey("admin_location.level_3"))
        assertNull(AdminLocation.parseKey("admin_location"))
        assertNull(AdminLocation.parseKey(".level_1"))
    }

    @Test
    fun `builds the web value shape limited to visible levels`() {
        val values = mapOf(
            "loc.level_0" to "BI", "loc.level_1" to "p1", "loc.level_2" to "c1", "loc.level_5" to "stale",
        )
        val json = AdminLocation.toJson("loc", values, listOf(0, 1, 2, 3, 4))!!
        assertEquals(setOf("level_0", "level_1", "level_2"), json.keys)
        assertEquals("BI", json["level_0"]!!.jsonPrimitive.content)
        assertNull(AdminLocation.toJson("loc", emptyMap(), listOf(0, 1)))
    }

    @Test
    fun `label falls back to english`() {
        assertEquals("N2", lvl(2).label("fr"))
        assertEquals("L2", lvl(2).label("pt"))
    }

    @Test
    fun `validator enforces required levels that are shown`() {
        val field = FormField(
            key = "loc", label = "Location", type = FormFieldType.ADMIN_CASCADER, required = true,
            adminLevels = all, adminRequiredLevels = listOf(0, 1, 5),
        )
        val v = FormValidator()
        // Level 5 is not shown for a 4-level country, so it is not required
        assertTrue(v.validate(listOf(field), mapOf("loc.level_0" to "BI", "loc.level_1" to "p")) { listOf(0, 1, 2, 3, 4) }.isEmpty())
        assertEquals(1, v.validate(listOf(field), mapOf("loc.level_0" to "BI")) { listOf(0, 1, 2, 3, 4) }.size)
        // Not required: nothing enforced
        assertTrue(v.validate(listOf(field.copy(required = false)), emptyMap()).isEmpty())
    }
}
