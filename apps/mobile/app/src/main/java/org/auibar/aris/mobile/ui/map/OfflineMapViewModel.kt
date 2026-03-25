package org.auibar.aris.mobile.ui.map

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.repository.GpsTrackRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import org.osmdroid.views.MapView
import javax.inject.Inject

data class MapLocation(
    val lat: Double,
    val lng: Double,
    val label: String,
    val status: String = "",
)

data class GpsTrackLine(
    val id: String,
    val points: List<MapLocation>,
)

data class OfflineMapUiState(
    val submissionLocations: List<MapLocation> = emptyList(),
    val outbreakLocations: List<MapLocation> = emptyList(),
    val gpsTracks: List<GpsTrackLine> = emptyList(),
    val showSubmissions: Boolean = true,
    val showOutbreaks: Boolean = true,
    val showGpsTracks: Boolean = true,
    val isDownloading: Boolean = false,
    val downloadProgress: Float = 0f,
    val downloadStatusText: String = "",
    val tileStorageSize: String = "0 B",
    val tileCount: Int = 0,
    val lastDownloadTime: Long = 0L,
    val regionPresets: List<MapTileManager.RegionPreset> = MapTileManager.RegionPreset.entries,
    val showPresetPicker: Boolean = false,
    // Tile source selection
    val selectedTileSource: MapTileManager.MapTileSource = MapTileManager.MapTileSource.OSM,
    // Dynamic initial center based on tenant
    val initialCenter: MapLocation? = null,
    val initialZoom: Double = DEFAULT_ZOOM,
    // Active GPS track (live recording)
    val activeGpsTrack: GpsTrackLine? = null,
    val isTrackingActive: Boolean = false,
    // Download estimation
    val pendingEstimate: MapTileManager.TileEstimate? = null,
    val showDownloadConfirm: Boolean = false,
    val pendingDownloadAction: DownloadAction? = null,
)

/** Describes what to download after user confirms the estimate dialog. */
sealed class DownloadAction {
    data class VisibleRegion(val mapView: MapView) : DownloadAction()
    data class Preset(val preset: MapTileManager.RegionPreset) : DownloadAction()
}

private const val DEFAULT_ZOOM = 6.0
private const val TAG = "OfflineMapVM"

@HiltViewModel
class OfflineMapViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val submissionRepository: SubmissionRepository,
    private val gpsTrackRepository: GpsTrackRepository,
    private val mapTileManager: MapTileManager,
    private val tokenManager: TokenManager,
    private val geoDao: GeoDao,
) : ViewModel() {

    private val domainKey: String? = savedStateHandle["domainKey"]

    private val _uiState = MutableStateFlow(OfflineMapUiState(
        selectedTileSource = mapTileManager.getSavedTileSource(),
    ))
    val uiState: StateFlow<OfflineMapUiState> = _uiState.asStateFlow()

    init {
        loadMapData()
        updateTileStorageInfo()
        resolveInitialCenter()
        observeActiveTrack()
    }

    // ── Tile source ─────────────────────────────────────────────────────

    fun selectTileSource(source: MapTileManager.MapTileSource) {
        mapTileManager.saveTileSource(source)
        _uiState.update { it.copy(selectedTileSource = source) }
    }

    // ── Tenant-based initial center ─────────────────────────────────────

    private fun resolveInitialCenter() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val tenantId = tokenManager.tenantId ?: return@launch
                val tenantLevel = tokenManager.tenantLevel

                val geo = geoDao.getById(tenantId)
                val isoCode = geo?.isoCode

                val preset = if (isoCode != null) {
                    MapTileManager.RegionPreset.fromIsoCode(isoCode)
                } else {
                    null
                }

                val zoom = when (tenantLevel?.uppercase()) {
                    "MEMBER_STATE" -> 7.0
                    "REC" -> 5.0
                    "CONTINENTAL" -> 4.0
                    else -> DEFAULT_ZOOM
                }

                if (preset != null) {
                    _uiState.update {
                        it.copy(
                            initialCenter = MapLocation(
                                lat = preset.centerLat,
                                lng = preset.centerLng,
                                label = preset.label,
                            ),
                            initialZoom = zoom,
                        )
                    }
                } else if (tenantLevel?.uppercase() == "CONTINENTAL") {
                    _uiState.update {
                        it.copy(
                            initialCenter = MapLocation(
                                lat = AFRICA_CENTER_LAT,
                                lng = AFRICA_CENTER_LNG,
                                label = "Africa",
                            ),
                            initialZoom = zoom,
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to resolve initial center: ${e.message}")
            }
        }
    }

    // ── Active GPS track (live) ─────────────────────────────────────────

    private fun observeActiveTrack() {
        viewModelScope.launch {
            gpsTrackRepository.observeActiveTrack().collect { track ->
                if (track != null && track.pointCount > 0) {
                    val points = parseGeoJsonCoordinates(track.geoJson)
                    _uiState.update {
                        it.copy(
                            activeGpsTrack = GpsTrackLine(id = track.id, points = points),
                            isTrackingActive = true,
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            activeGpsTrack = null,
                            isTrackingActive = false,
                        )
                    }
                }
            }
        }
    }

    // ── Layer toggles ───────────────────────────────────────────────────

    private fun loadMapData() {
        viewModelScope.launch {
            submissionRepository.getAll().collect { submissions ->
                val domainFiltered = if (domainKey != null) {
                    submissions.filter { sub ->
                        sub.templateId.contains(domainKey, ignoreCase = true) ||
                            sub.data.contains(domainKey, ignoreCase = true)
                    }
                } else {
                    submissions
                }
                val geoSubs = domainFiltered.filter { it.gpsLat != null && it.gpsLng != null }

                val locations = geoSubs.map { sub ->
                    MapLocation(
                        lat = sub.gpsLat!!,
                        lng = sub.gpsLng!!,
                        label = sub.campaignId,
                        status = sub.syncStatus,
                    )
                }

                val outbreaks = geoSubs
                    .filter { sub ->
                        sub.data.contains("outbreak", ignoreCase = true) ||
                            sub.templateId.contains("outbreak", ignoreCase = true) ||
                            sub.templateId.contains("health", ignoreCase = true)
                    }
                    .take(MAX_OUTBREAK_MARKERS)
                    .map { sub ->
                        MapLocation(
                            lat = sub.gpsLat!!,
                            lng = sub.gpsLng!!,
                            label = sub.campaignId,
                            status = "outbreak",
                        )
                    }

                _uiState.update {
                    it.copy(
                        submissionLocations = locations,
                        outbreakLocations = outbreaks,
                    )
                }
            }
        }

        viewModelScope.launch {
            gpsTrackRepository.getAll().collect { tracks ->
                val trackLines = tracks
                    .filter { it.pointCount > 0 }
                    .map { track ->
                        val points = parseGeoJsonCoordinates(track.geoJson)
                        GpsTrackLine(id = track.id, points = points)
                    }
                _uiState.update { it.copy(gpsTracks = trackLines) }
            }
        }
    }

    fun toggleSubmissions() {
        _uiState.update { it.copy(showSubmissions = !it.showSubmissions) }
    }

    fun toggleOutbreaks() {
        _uiState.update { it.copy(showOutbreaks = !it.showOutbreaks) }
    }

    fun toggleGpsTracks() {
        _uiState.update { it.copy(showGpsTracks = !it.showGpsTracks) }
    }

    fun togglePresetPicker() {
        _uiState.update { it.copy(showPresetPicker = !it.showPresetPicker) }
    }

    // ── Download with estimation dialog ─────────────────────────────────

    fun requestDownloadForVisibleRegion(mapView: MapView?) {
        if (mapView == null) return
        val bounds = mapView.boundingBox
        val zoom = mapView.zoomLevelDouble.toInt()
        val source = _uiState.value.selectedTileSource

        viewModelScope.launch(Dispatchers.IO) {
            val estimate = mapTileManager.estimateTileCount(
                minLat = bounds.latSouth,
                maxLat = bounds.latNorth,
                minLng = bounds.lonWest,
                maxLng = bounds.lonEast,
                minZoom = zoom.coerceAtLeast(1),
                maxZoom = (zoom + 2).coerceAtMost(MAX_DOWNLOAD_ZOOM),
                tileSource = source,
            )
            _uiState.update {
                it.copy(
                    pendingEstimate = estimate,
                    showDownloadConfirm = true,
                    pendingDownloadAction = DownloadAction.VisibleRegion(mapView),
                )
            }
        }
    }

    fun requestDownloadPreset(preset: MapTileManager.RegionPreset) {
        val source = _uiState.value.selectedTileSource

        viewModelScope.launch(Dispatchers.IO) {
            val estimate = mapTileManager.estimatePreset(preset, tileSource = source)
            _uiState.update {
                it.copy(
                    pendingEstimate = estimate,
                    showDownloadConfirm = true,
                    pendingDownloadAction = DownloadAction.Preset(preset),
                    showPresetPicker = false,
                )
            }
        }
    }

    fun confirmDownload() {
        val action = _uiState.value.pendingDownloadAction ?: return
        _uiState.update { it.copy(showDownloadConfirm = false, pendingEstimate = null, pendingDownloadAction = null) }

        when (action) {
            is DownloadAction.VisibleRegion -> doDownloadVisibleRegion(action.mapView)
            is DownloadAction.Preset -> doDownloadPreset(action.preset)
        }
    }

    fun cancelDownload() {
        _uiState.update { it.copy(showDownloadConfirm = false, pendingEstimate = null, pendingDownloadAction = null) }
    }

    private fun doDownloadVisibleRegion(mapView: MapView) {
        val bounds = mapView.boundingBox
        val zoom = mapView.zoomLevelDouble.toInt()
        val source = _uiState.value.selectedTileSource

        viewModelScope.launch {
            _uiState.update { it.copy(isDownloading = true, downloadProgress = 0f, downloadStatusText = "Preparing...") }
            try {
                val result = mapTileManager.downloadRegion(
                    minLat = bounds.latSouth,
                    maxLat = bounds.latNorth,
                    minLng = bounds.lonWest,
                    maxLng = bounds.lonEast,
                    minZoom = zoom.coerceAtLeast(1),
                    maxZoom = (zoom + 2).coerceAtMost(MAX_DOWNLOAD_ZOOM),
                    tileSource = source,
                    onProgress = { done, total ->
                        _uiState.update {
                            it.copy(
                                downloadProgress = if (total > 0) done.toFloat() / total else 0f,
                                downloadStatusText = "$done / $total tiles",
                            )
                        }
                    },
                )
                _uiState.update {
                    it.copy(
                        downloadStatusText = "${result.downloaded} downloaded, ${result.skipped} cached, ${result.failed} failed",
                    )
                }
            } finally {
                _uiState.update { it.copy(isDownloading = false) }
                updateTileStorageInfo()
            }
        }
    }

    private fun doDownloadPreset(preset: MapTileManager.RegionPreset) {
        val source = _uiState.value.selectedTileSource

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isDownloading = true,
                    downloadProgress = 0f,
                    downloadStatusText = "Downloading ${preset.label}...",
                )
            }
            try {
                val result = mapTileManager.downloadRegionPreset(
                    preset = preset,
                    tileSource = source,
                    onProgress = { done, total ->
                        _uiState.update {
                            it.copy(
                                downloadProgress = if (total > 0) done.toFloat() / total else 0f,
                                downloadStatusText = "${preset.label}: $done / $total",
                            )
                        }
                    },
                )
                _uiState.update {
                    it.copy(
                        downloadStatusText = "${preset.label}: ${result.downloaded} new, ${result.skipped} cached",
                    )
                }
            } finally {
                _uiState.update { it.copy(isDownloading = false) }
                updateTileStorageInfo()
            }
        }
    }

    /** Legacy direct download (kept for backward compatibility if needed). */
    fun downloadTilesForVisibleRegion(mapView: MapView?) {
        requestDownloadForVisibleRegion(mapView)
    }

    fun downloadPreset(preset: MapTileManager.RegionPreset) {
        requestDownloadPreset(preset)
    }

    fun pruneExpiredTiles() {
        viewModelScope.launch(Dispatchers.IO) {
            val pruned = mapTileManager.pruneExpiredTiles()
            _uiState.update { it.copy(downloadStatusText = "$pruned expired tiles removed") }
            updateTileStorageInfo()
        }
    }

    fun deleteTiles() {
        viewModelScope.launch(Dispatchers.IO) {
            mapTileManager.clearTileCache()
            updateTileStorageInfo()
        }
    }

    private fun updateTileStorageInfo() {
        viewModelScope.launch(Dispatchers.IO) {
            val size = mapTileManager.getTileCacheSize()
            val count = mapTileManager.getTileCount()
            val lastDl = mapTileManager.getLastDownloadTime()
            _uiState.update {
                it.copy(
                    tileStorageSize = MapTileManager.formatSize(size),
                    tileCount = count,
                    lastDownloadTime = lastDl,
                )
            }
        }
    }

    private fun parseGeoJsonCoordinates(geoJson: String): List<MapLocation> {
        val coordsStart = geoJson.indexOf("\"coordinates\":")
        if (coordsStart == -1) return emptyList()
        val arrayStart = geoJson.indexOf("[[", coordsStart)
        if (arrayStart == -1) return emptyList()
        val arrayEnd = geoJson.indexOf("]]", arrayStart)
        if (arrayEnd == -1) return emptyList()
        val coordsStr = geoJson.substring(arrayStart + 1, arrayEnd + 1)
        return coordsStr.split("],[").mapNotNull { pair ->
            val clean = pair.removePrefix("[").removeSuffix("]")
            val parts = clean.split(",")
            if (parts.size >= 2) {
                val lng = parts[0].trim().toDoubleOrNull() ?: return@mapNotNull null
                val lat = parts[1].trim().toDoubleOrNull() ?: return@mapNotNull null
                MapLocation(lat = lat, lng = lng, label = "")
            } else {
                null
            }
        }
    }

    companion object {
        private const val MAX_OUTBREAK_MARKERS = 20
        private const val MAX_DOWNLOAD_ZOOM = 16
        private const val AFRICA_CENTER_LAT = 1.0
        private const val AFRICA_CENTER_LNG = 20.0
    }
}
