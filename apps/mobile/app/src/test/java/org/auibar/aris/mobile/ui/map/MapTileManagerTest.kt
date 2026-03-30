package org.auibar.aris.mobile.ui.map

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for MapTileManager's RegionPreset and tile estimation logic.
 * Tests pure math functions without requiring Android context.
 */
class MapTileManagerTest {

    // ── Tile coordinate calculation ─────────────────────────────────

    @Test
    fun `tile count for single zoom level over small region`() {
        val count = estimateTiles(-1.3, -1.2, 36.7, 36.9, 10, 10)
        assertTrue("Expected at least 1 tile, got $count", count >= 1)
        assertTrue("Expected less than 10 tiles for small region at zoom 10, got $count", count < 10)
    }

    @Test
    fun `tile count increases with zoom level`() {
        val countZ8 = estimateTiles(-1.5, -1.0, 36.5, 37.0, 8, 8)
        val countZ12 = estimateTiles(-1.5, -1.0, 36.5, 37.0, 12, 12)
        assertTrue("Higher zoom should produce more tiles: z8=$countZ8, z12=$countZ12", countZ12 > countZ8)
    }

    @Test
    fun `tile count for multiple zoom levels sums correctly`() {
        val countZ5 = estimateTiles(-1.5, -1.0, 36.5, 37.0, 5, 5)
        val countZ6 = estimateTiles(-1.5, -1.0, 36.5, 37.0, 6, 6)
        val countRange = estimateTiles(-1.5, -1.0, 36.5, 37.0, 5, 6)
        assertEquals(countZ5 + countZ6, countRange)
    }

    // ── RegionPreset ────────────────────────────────────────────────

    @Test
    fun `Africa preset covers full continent`() {
        val preset = MapTileManager.RegionPreset.AFRICA
        assertTrue(preset.minLat < -30.0)
        assertTrue(preset.maxLat > 35.0)
        assertTrue(preset.minLng < -20.0)
        assertTrue(preset.maxLng > 50.0)
    }

    @Test
    fun `Kenya preset is within East Africa`() {
        val kenya = MapTileManager.RegionPreset.KENYA
        assertTrue(kenya.minLat > -6.0)
        assertTrue(kenya.maxLat < 6.0)
        assertTrue(kenya.minLng > 33.0)
        assertTrue(kenya.maxLng < 43.0)
    }

    @Test
    fun `all presets have valid bounding boxes`() {
        MapTileManager.RegionPreset.entries.forEach { preset ->
            assertTrue("${preset.name}: minLat should < maxLat", preset.minLat < preset.maxLat)
            assertTrue("${preset.name}: minLng should < maxLng", preset.minLng < preset.maxLng)
        }
    }

    @Test
    fun `preset center is within bounding box`() {
        MapTileManager.RegionPreset.entries.forEach { preset ->
            assertTrue("${preset.name}: centerLat within bounds",
                preset.centerLat in preset.minLat..preset.maxLat)
            assertTrue("${preset.name}: centerLng within bounds",
                preset.centerLng in preset.minLng..preset.maxLng)
        }
    }

    @Test
    fun `fromIsoCode returns correct preset`() {
        assertEquals(MapTileManager.RegionPreset.KENYA, MapTileManager.RegionPreset.fromIsoCode("KE"))
        assertEquals(MapTileManager.RegionPreset.ETHIOPIA, MapTileManager.RegionPreset.fromIsoCode("ET"))
        assertEquals(MapTileManager.RegionPreset.NIGERIA, MapTileManager.RegionPreset.fromIsoCode("NG"))
    }

    @Test
    fun `fromIsoCode is case insensitive`() {
        assertNotNull(MapTileManager.RegionPreset.fromIsoCode("ke"))
        assertNotNull(MapTileManager.RegionPreset.fromIsoCode("Ke"))
    }

    @Test
    fun `fromIsoCode returns null for unknown code`() {
        assertNull(MapTileManager.RegionPreset.fromIsoCode("XX"))
        assertNull(MapTileManager.RegionPreset.fromIsoCode(""))
    }

    @Test
    fun `there are 11 region presets`() {
        assertEquals(11, MapTileManager.RegionPreset.entries.size)
    }

    // ── Helper: pure tile estimation matching MapTileManager logic ──

    private fun estimateTiles(
        minLat: Double, maxLat: Double,
        minLon: Double, maxLon: Double,
        minZoom: Int, maxZoom: Int,
    ): Int {
        var total = 0
        for (z in minZoom..maxZoom) {
            val n = 1 shl z
            val xMin = ((minLon + 180.0) / 360.0 * n).toInt()
            val xMax = ((maxLon + 180.0) / 360.0 * n).toInt()
            val yMin = tileY(maxLat, z)
            val yMax = tileY(minLat, z)
            total += (xMax - xMin + 1) * (yMax - yMin + 1)
        }
        return total
    }

    private fun tileY(lat: Double, zoom: Int): Int {
        val n = 1 shl zoom
        val latRad = Math.toRadians(lat)
        return ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n).toInt()
    }
}
