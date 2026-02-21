package org.auibar.aris.mobile.ui.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.repository.GpsTrackRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
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
    val tileStorageSize: String = "0 B",
)

@HiltViewModel
class OfflineMapViewModel @Inject constructor(
    private val submissionRepository: SubmissionRepository,
    private val gpsTrackRepository: GpsTrackRepository,
    private val mapTileManager: MapTileManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OfflineMapUiState())
    val uiState: StateFlow<OfflineMapUiState> = _uiState.asStateFlow()

    init {
        loadMapData()
        updateTileStorageSize()
    }

    private fun loadMapData() {
        // Collect submissions reactively
        viewModelScope.launch {
            submissionRepository.getAll().collect { submissions ->
                val locations = submissions
                    .filter { it.gpsLat != null && it.gpsLng != null }
                    .map { sub ->
                        MapLocation(
                            lat = sub.gpsLat!!,
                            lng = sub.gpsLng!!,
                            label = sub.campaignId,
                            status = sub.syncStatus,
                        )
                    }

                // Outbreak markers: submissions with "outbreak" in data or SYNCED status
                val outbreaks = locations
                    .filter {
                        it.status.contains("outbreak", ignoreCase = true) ||
                            it.status == "SYNCED"
                    }
                    .take(MAX_OUTBREAK_MARKERS)

                _uiState.update {
                    it.copy(
                        submissionLocations = locations,
                        outbreakLocations = outbreaks,
                    )
                }
            }
        }

        // Collect GPS tracks reactively
        viewModelScope.launch {
            gpsTrackRepository.getAll().collect { tracks ->
                val trackLines = tracks
                    .filter { it.pointCount > 0 }
                    .map { track ->
                        val points = parseGeoJsonCoordinates(track.geoJson)
                        GpsTrackLine(
                            id = track.id,
                            points = points,
                        )
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

    fun downloadTilesForVisibleRegion(mapView: MapView?) {
        if (mapView == null) return
        val bounds = mapView.boundingBox
        val zoom = mapView.zoomLevelDouble.toInt()

        viewModelScope.launch {
            _uiState.update { it.copy(isDownloading = true) }
            try {
                mapTileManager.downloadRegion(
                    minLat = bounds.latSouth,
                    maxLat = bounds.latNorth,
                    minLng = bounds.lonWest,
                    maxLng = bounds.lonEast,
                    minZoom = zoom.coerceAtLeast(1),
                    maxZoom = (zoom + 2).coerceAtMost(MAX_DOWNLOAD_ZOOM),
                )
            } finally {
                _uiState.update { it.copy(isDownloading = false) }
                updateTileStorageSize()
            }
        }
    }

    fun deleteTiles() {
        viewModelScope.launch(Dispatchers.IO) {
            mapTileManager.clearTileCache()
            updateTileStorageSize()
        }
    }

    private fun updateTileStorageSize() {
        viewModelScope.launch(Dispatchers.IO) {
            val size = mapTileManager.getTileCacheSize()
            _uiState.update { it.copy(tileStorageSize = formatSize(size)) }
        }
    }

    /**
     * Parse GeoJSON LineString coordinates into MapLocation list.
     * GeoJSON stores coordinates as [longitude, latitude].
     */
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
