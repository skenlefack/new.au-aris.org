package org.auibar.aris.mobile.ui.map

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.tileprovider.tilesource.XYTileSource
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages OSMDroid tile cache for offline map usage.
 * Supports region presets, download progress, tile expiry,
 * storage quota, per-tile staleness checks, and multiple tile sources.
 */
@Singleton
class MapTileManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val tileCache: File
        get() = Configuration.getInstance().osmdroidTileCache
            ?: context.cacheDir.resolve("osmdroid")

    private val prefs: SharedPreferences =
        context.getSharedPreferences("aris_tile_cache", Context.MODE_PRIVATE)

    /**
     * Estimate tile count and download size for a bounding box without downloading.
     */
    fun estimateTileCount(
        minLat: Double,
        maxLat: Double,
        minLng: Double,
        maxLng: Double,
        minZoom: Int,
        maxZoom: Int,
        tileSource: MapTileSource = MapTileSource.OSM,
    ): TileEstimate {
        var totalTiles = 0
        var cachedTiles = 0
        val sourceName = tileSource.sourceName

        for (zoom in minZoom..maxZoom.coerceAtMost(tileSource.maxZoom)) {
            val n = 1 shl zoom
            val xMin = ((minLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val xMax = ((maxLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val yMin = latToTileY(maxLat, n).coerceIn(0, n - 1)
            val yMax = latToTileY(minLat, n).coerceIn(0, n - 1)
            for (x in xMin..xMax) {
                for (y in yMin..yMax) {
                    totalTiles++
                    val tileFile = File(tileCache, "$sourceName/$zoom/$x/$y.png")
                    if (tileFile.exists() && !isTileStale(tileFile)) {
                        cachedTiles++
                    }
                }
            }
        }

        val toDownload = totalTiles - cachedTiles
        return TileEstimate(
            totalTiles = totalTiles,
            cachedTiles = cachedTiles,
            estimatedDownloadBytes = toDownload.toLong() * AVG_TILE_SIZE_BYTES,
        )
    }

    /**
     * Estimate tile count for a predefined region preset.
     */
    fun estimatePreset(
        preset: RegionPreset,
        maxZoom: Int = DEFAULT_PRESET_ZOOM,
        tileSource: MapTileSource = MapTileSource.OSM,
    ): TileEstimate {
        return estimateTileCount(
            minLat = preset.minLat,
            maxLat = preset.maxLat,
            minLng = preset.minLng,
            maxLng = preset.maxLng,
            minZoom = preset.minZoom,
            maxZoom = maxZoom.coerceAtMost(preset.maxZoom),
            tileSource = tileSource,
        )
    }

    /**
     * Download tiles for a bounding box at specified zoom levels.
     * Reports progress via callback. Skips tiles that are fresh (< TILE_EXPIRY_MS old).
     */
    suspend fun downloadRegion(
        minLat: Double,
        maxLat: Double,
        minLng: Double,
        maxLng: Double,
        minZoom: Int,
        maxZoom: Int,
        tileSource: MapTileSource = MapTileSource.OSM,
        onProgress: ((downloaded: Int, total: Int) -> Unit)? = null,
    ): DownloadResult = withContext(Dispatchers.IO) {
        val sourceName = tileSource.sourceName
        val effectiveMaxZoom = maxZoom.coerceAtMost(tileSource.maxZoom)

        // Count tiles first
        var totalTiles = 0
        for (zoom in minZoom..effectiveMaxZoom) {
            val n = 1 shl zoom
            val xMin = ((minLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val xMax = ((maxLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val yMin = latToTileY(maxLat, n).coerceIn(0, n - 1)
            val yMax = latToTileY(minLat, n).coerceIn(0, n - 1)
            totalTiles += (xMax - xMin + 1) * (yMax - yMin + 1)
        }

        // Enforce quota: don't exceed storage limit
        val currentSize = getTileCacheSize()
        if (currentSize > STORAGE_QUOTA_BYTES) {
            return@withContext DownloadResult(0, 0, totalTiles, "Storage quota exceeded (${formatSize(currentSize)})")
        }

        // Safety limit: cap download at MAX_TILES_PER_DOWNLOAD
        val cappedMaxZoom = if (totalTiles > MAX_TILES_PER_DOWNLOAD) {
            var capped = minZoom
            var count = 0
            for (z in minZoom..effectiveMaxZoom) {
                val n = 1 shl z
                val xMin = ((minLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
                val xMax = ((maxLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
                val yMin = latToTileY(maxLat, n).coerceIn(0, n - 1)
                val yMax = latToTileY(minLat, n).coerceIn(0, n - 1)
                count += (xMax - xMin + 1) * (yMax - yMin + 1)
                if (count > MAX_TILES_PER_DOWNLOAD) break
                capped = z
            }
            capped
        } else {
            effectiveMaxZoom
        }

        var downloaded = 0
        var skipped = 0
        var failed = 0
        var processed = 0

        for (zoom in minZoom..cappedMaxZoom) {
            val n = 1 shl zoom
            val xMin = ((minLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val xMax = ((maxLng + 180.0) / 360.0 * n).toInt().coerceIn(0, n - 1)
            val yMin = latToTileY(maxLat, n).coerceIn(0, n - 1)
            val yMax = latToTileY(minLat, n).coerceIn(0, n - 1)

            for (x in xMin..xMax) {
                for (y in yMin..yMax) {
                    processed++
                    try {
                        val tileFile = File(tileCache, "$sourceName/$zoom/$x/$y.png")

                        // Skip tiles that are still fresh
                        if (tileFile.exists() && !isTileStale(tileFile)) {
                            skipped++
                            onProgress?.invoke(processed, totalTiles)
                            continue
                        }

                        tileFile.parentFile?.mkdirs()
                        val url = tileSource.buildTileUrl(zoom, x, y)
                        val connection = java.net.URL(url).openConnection()
                        connection.setRequestProperty("User-Agent", USER_AGENT)
                        connection.connectTimeout = CONNECT_TIMEOUT_MS
                        connection.readTimeout = READ_TIMEOUT_MS
                        connection.getInputStream().use { input ->
                            tileFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        downloaded++
                    } catch (e: Exception) {
                        failed++
                        Log.w(TAG, "Failed tile $zoom/$x/$y: ${e.message}")
                    }
                    onProgress?.invoke(processed, totalTiles)
                }
            }
        }

        // Record download timestamp for the region
        prefs.edit().putLong(KEY_LAST_DOWNLOAD, System.currentTimeMillis()).apply()

        DownloadResult(downloaded, skipped, failed)
    }

    /**
     * Download tiles for a predefined African region preset.
     */
    suspend fun downloadRegionPreset(
        preset: RegionPreset,
        maxZoom: Int = DEFAULT_PRESET_ZOOM,
        tileSource: MapTileSource = MapTileSource.OSM,
        onProgress: ((downloaded: Int, total: Int) -> Unit)? = null,
    ): DownloadResult {
        return downloadRegion(
            minLat = preset.minLat,
            maxLat = preset.maxLat,
            minLng = preset.minLng,
            maxLng = preset.maxLng,
            minZoom = preset.minZoom,
            maxZoom = maxZoom.coerceAtMost(preset.maxZoom),
            tileSource = tileSource,
            onProgress = onProgress,
        )
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
     * Get tile count in cache.
     */
    fun getTileCount(): Int {
        return if (tileCache.exists()) {
            tileCache.walkTopDown().filter { it.isFile && it.extension == "png" }.count()
        } else {
            0
        }
    }

    /**
     * Remove tiles older than TILE_EXPIRY_MS to free space.
     */
    suspend fun pruneExpiredTiles(): Int = withContext(Dispatchers.IO) {
        var pruned = 0
        if (tileCache.exists()) {
            val now = System.currentTimeMillis()
            tileCache.walkTopDown()
                .filter { it.isFile && it.extension == "png" }
                .forEach { file ->
                    if (now - file.lastModified() > TILE_EXPIRY_MS) {
                        if (file.delete()) pruned++
                    }
                }
            // Clean empty directories
            tileCache.walkBottomUp()
                .filter { it.isDirectory && it != tileCache }
                .forEach { dir ->
                    if (dir.listFiles()?.isEmpty() == true) dir.delete()
                }
        }
        pruned
    }

    /**
     * Clear all cached tiles.
     */
    fun clearTileCache() {
        if (tileCache.exists()) {
            tileCache.deleteRecursively()
            tileCache.mkdirs()
        }
        prefs.edit().remove(KEY_LAST_DOWNLOAD).apply()
    }

    fun getLastDownloadTime(): Long = prefs.getLong(KEY_LAST_DOWNLOAD, 0L)

    /** Get the persisted tile source preference. */
    fun getSavedTileSource(): MapTileSource {
        val name = prefs.getString(KEY_TILE_SOURCE, null) ?: return MapTileSource.OSM
        return MapTileSource.entries.find { it.name == name } ?: MapTileSource.OSM
    }

    /** Persist tile source preference. */
    fun saveTileSource(source: MapTileSource) {
        prefs.edit().putString(KEY_TILE_SOURCE, source.name).apply()
    }

    /**
     * Check if a tile file is stale (older than expiry threshold).
     */
    private fun isTileStale(file: File): Boolean {
        return System.currentTimeMillis() - file.lastModified() > TILE_EXPIRY_MS
    }

    /**
     * Convert latitude to tile Y coordinate using the Mercator projection formula.
     */
    private fun latToTileY(lat: Double, n: Int): Int {
        val latRad = Math.toRadians(lat)
        return ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n).toInt()
    }

    data class TileEstimate(
        val totalTiles: Int,
        val cachedTiles: Int,
        val estimatedDownloadBytes: Long,
    ) {
        val toDownload: Int get() = totalTiles - cachedTiles
        val formattedSize: String get() = formatSize(estimatedDownloadBytes)
    }

    data class DownloadResult(
        val downloaded: Int,
        val skipped: Int,
        val failed: Int,
        val error: String? = null,
    )

    /**
     * Available map tile sources. Each source stores tiles in its own cache directory.
     */
    enum class MapTileSource(
        val label: String,
        val sourceName: String,
        val maxZoom: Int,
        private val urlTemplate: String,
        private val servers: Array<String>,
    ) {
        OSM(
            label = "CartoDB Light",
            sourceName = "CartoLight",
            maxZoom = 19,
            urlTemplate = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            servers = arrayOf("a", "b", "c"),
        ),
        TOPO(
            label = "OpenTopoMap",
            sourceName = "OpenTopoMap",
            maxZoom = 17,
            urlTemplate = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
            servers = arrayOf("a", "b", "c"),
        ),
        HUMANITARIAN(
            label = "CartoDB Voyager",
            sourceName = "CartoVoyager",
            maxZoom = 19,
            urlTemplate = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            servers = arrayOf("a", "b", "c"),
        );

        /** Build a tile download URL using round-robin server selection. */
        fun buildTileUrl(zoom: Int, x: Int, y: Int): String {
            val server = servers[(x + y) % servers.size]
            return urlTemplate
                .replace("{s}", server)
                .replace("{z}", zoom.toString())
                .replace("{x}", x.toString())
                .replace("{y}", y.toString())
        }

        /** Create an OSMDroid XYTileSource for this map source. */
        fun toOsmTileSource(): XYTileSource {
            return XYTileSource(
                sourceName,
                0,
                maxZoom,
                256,
                ".png",
                servers.map { s ->
                    urlTemplate
                        .replace("{s}", s)
                        .replace("{z}", "\${z}")
                        .replace("{x}", "\${x}")
                        .replace("{y}", "\${y}")
                }.toTypedArray(),
            )
        }
    }

    /**
     * Predefined region presets for African countries and RECs.
     * Covers the 8 RECs + key member states for quick offline map setup.
     */
    enum class RegionPreset(
        val label: String,
        val isoCode: String?,
        val minLat: Double,
        val maxLat: Double,
        val minLng: Double,
        val maxLng: Double,
        val minZoom: Int = 4,
        val maxZoom: Int = 10,
    ) {
        AFRICA("Africa", null, -35.0, 37.5, -25.0, 52.0, 3, 7),
        EAST_AFRICA("East Africa (IGAD)", null, -12.0, 23.0, 22.0, 52.0, 4, 9),
        WEST_AFRICA("West Africa (ECOWAS)", null, 0.0, 25.0, -18.0, 16.0, 4, 9),
        CENTRAL_AFRICA("Central Africa (ECCAS)", null, -14.0, 24.0, 5.0, 32.0, 4, 9),
        SOUTHERN_AFRICA("Southern Africa (SADC)", null, -35.0, -1.0, 10.0, 41.0, 4, 9),
        NORTH_AFRICA("North Africa (UMA)", null, 15.0, 38.0, -18.0, 35.0, 4, 9),
        KENYA("Kenya", "KE", -5.0, 5.5, 33.5, 42.0, 5, 12),
        ETHIOPIA("Ethiopia", "ET", 3.0, 15.0, 33.0, 48.0, 5, 12),
        NIGERIA("Nigeria", "NG", 4.0, 14.0, 2.5, 15.0, 5, 12),
        SENEGAL("Senegal", "SN", 12.0, 17.0, -18.0, -11.0, 5, 12),
        SOUTH_AFRICA("South Africa", "ZA", -35.0, -22.0, 16.0, 33.0, 5, 12);

        /** Center latitude of this region. */
        val centerLat: Double get() = (minLat + maxLat) / 2.0
        /** Center longitude of this region. */
        val centerLng: Double get() = (minLng + maxLng) / 2.0

        companion object {
            /** Find a preset by ISO 3166-1 alpha-2 country code. */
            fun fromIsoCode(iso: String): RegionPreset? =
                entries.find { it.isoCode.equals(iso, ignoreCase = true) }
        }
    }

    companion object {
        private const val TAG = "MapTileManager"
        private const val MAX_TILES_PER_DOWNLOAD = 5000
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val READ_TIMEOUT_MS = 10_000
        private const val USER_AGENT = "ARIS-Mobile/1.0"
        private const val TILE_EXPIRY_MS = 30L * 24 * 60 * 60 * 1000 // 30 days
        private const val STORAGE_QUOTA_BYTES = 500L * 1024 * 1024 // 500 MB
        private const val DEFAULT_PRESET_ZOOM = 10
        private const val KEY_LAST_DOWNLOAD = "last_tile_download"
        private const val KEY_TILE_SOURCE = "tile_source"
        const val AVG_TILE_SIZE_BYTES = 15_000L // ~15KB per OSM tile

        fun formatSize(bytes: Long): String {
            return when {
                bytes < 1024 -> "$bytes B"
                bytes < 1024 * 1024 -> "${bytes / 1024} KB"
                bytes < 1024L * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
                else -> String.format("%.1f GB", bytes.toDouble() / (1024 * 1024 * 1024))
            }
        }
    }
}
