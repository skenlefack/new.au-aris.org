package org.auibar.aris.mobile.ui.map

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages OSMDroid tile cache for offline map usage.
 * Downloads tiles for a specified geographic region and zoom levels.
 */
@Singleton
class MapTileManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val tileCache: File
        get() = Configuration.getInstance().osmdroidTileCache
            ?: context.cacheDir.resolve("osmdroid")

    /**
     * Download tiles for a bounding box at specified zoom levels.
     * Manually fetches tiles from OpenStreetMap and stores them in the OSMDroid cache directory.
     */
    suspend fun downloadRegion(
        minLat: Double,
        maxLat: Double,
        minLng: Double,
        maxLng: Double,
        minZoom: Int,
        maxZoom: Int,
    ) = withContext(Dispatchers.IO) {
        // Estimate tile count to avoid downloading too many
        var totalTiles = 0
        for (zoom in minZoom..maxZoom) {
            val tilesX = ((maxLng - minLng) / (360.0 / (1 shl zoom))).toInt() + 1
            val tilesY = ((maxLat - minLat) / (180.0 / (1 shl zoom))).toInt() + 1
            totalTiles += tilesX * tilesY
        }

        // Safety limit: don't download more than 5000 tiles at once
        val effectiveMaxZoom = if (totalTiles > MAX_TILES_PER_DOWNLOAD) {
            (minZoom + 1).coerceAtMost(maxZoom)
        } else {
            maxZoom
        }

        val tileSource = TileSourceFactory.MAPNIK

        for (zoom in minZoom..effectiveMaxZoom) {
            val n = 1 shl zoom
            val xMin = ((minLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val xMax = ((maxLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val yMin = latToTileY(maxLat, n).coerceIn(0, n - 1)
            val yMax = latToTileY(minLat, n).coerceIn(0, n - 1)

            for (x in xMin..xMax) {
                for (y in yMin..yMax) {
                    try {
                        val tileFile = File(tileCache, "${tileSource.name()}/$zoom/$x/$y.png")
                        if (!tileFile.exists()) {
                            tileFile.parentFile?.mkdirs()
                            val url = "https://tile.openstreetmap.org/$zoom/$x/$y.png"
                            val connection = java.net.URL(url).openConnection()
                            connection.setRequestProperty("User-Agent", USER_AGENT)
                            connection.connectTimeout = CONNECT_TIMEOUT_MS
                            connection.readTimeout = READ_TIMEOUT_MS
                            connection.getInputStream().use { input ->
                                tileFile.outputStream().use { output ->
                                    input.copyTo(output)
                                }
                            }
                        }
                    } catch (_: Exception) {
                        // Skip failed tiles, continue with others
                    }
                }
            }
        }
    }

    /**
     * Get the total size of cached tiles in bytes.
     */
    fun getTileCacheSize(): Long {
        return if (tileCache.exists()) {
            tileCache.walkTopDown().filter { it.isFile }.sumOf { it.length() }
        } else {
            0L
        }
    }

    /**
     * Clear all cached tiles.
     */
    fun clearTileCache() {
        if (tileCache.exists()) {
            tileCache.deleteRecursively()
            tileCache.mkdirs()
        }
    }

    /**
     * Convert latitude to tile Y coordinate using the Mercator projection formula.
     */
    private fun latToTileY(lat: Double, n: Int): Int {
        val latRad = Math.toRadians(lat)
        return ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n).toInt()
    }

    companion object {
        private const val MAX_TILES_PER_DOWNLOAD = 5000
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val READ_TIMEOUT_MS = 10_000
        private const val USER_AGENT = "ARIS-Mobile/1.0"
    }
}
