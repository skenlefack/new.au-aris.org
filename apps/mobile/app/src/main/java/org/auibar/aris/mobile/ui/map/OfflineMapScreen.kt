package org.auibar.aris.mobile.ui.map

import android.view.ViewGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfflineMapScreen(
    onBack: () -> Unit = {},
    viewModel: OfflineMapViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var mapView by remember { mutableStateOf<MapView?>(null) }
    var showLayersSheet by remember { mutableStateOf(false) }

    // Initialize OSMDroid config
    LaunchedEffect(Unit) {
        Configuration.getInstance().userAgentValue = context.packageName
        Configuration.getInstance().osmdroidBasePath = context.filesDir
        Configuration.getInstance().osmdroidTileCache = context.cacheDir.resolve("osmdroid")
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.offline_maps)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back_button),
                        )
                    }
                },
                actions = {
                    // Layer toggle
                    IconButton(onClick = { showLayersSheet = true }) {
                        Icon(
                            Icons.Default.Layers,
                            contentDescription = stringResource(R.string.map_layers),
                        )
                    }
                    // Download tiles
                    IconButton(onClick = { viewModel.downloadTilesForVisibleRegion(mapView) }) {
                        Icon(
                            Icons.Default.CloudDownload,
                            contentDescription = stringResource(R.string.download_tiles),
                        )
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            // OSMDroid MapView wrapped in AndroidView
            AndroidView(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics {
                        contentDescription = "Map showing submission locations and GPS tracks"
                    },
                factory = { ctx ->
                    MapView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        setTileSource(TileSourceFactory.MAPNIK)
                        setMultiTouchControls(true)
                        controller.setZoom(DEFAULT_ZOOM)
                        // Default center: Africa center
                        controller.setCenter(GeoPoint(AFRICA_CENTER_LAT, AFRICA_CENTER_LNG))
                        mapView = this
                    }
                },
                update = { view ->
                    view.overlays.clear()

                    // Submission markers
                    if (uiState.showSubmissions) {
                        uiState.submissionLocations.forEach { loc ->
                            val marker = Marker(view)
                            marker.position = GeoPoint(loc.lat, loc.lng)
                            marker.title = loc.label
                            marker.snippet = loc.status
                            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            view.overlays.add(marker)
                        }
                    }

                    // Outbreak markers
                    if (uiState.showOutbreaks) {
                        uiState.outbreakLocations.forEach { loc ->
                            val marker = Marker(view)
                            marker.position = GeoPoint(loc.lat, loc.lng)
                            marker.title = loc.label
                            marker.snippet = "Outbreak"
                            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            view.overlays.add(marker)
                        }
                    }

                    // GPS tracks
                    if (uiState.showGpsTracks) {
                        uiState.gpsTracks.forEach { track ->
                            val polyline = Polyline()
                            polyline.setPoints(
                                track.points.map { GeoPoint(it.lat, it.lng) },
                            )
                            polyline.outlinePaint.color =
                                android.graphics.Color.parseColor(TRACK_COLOR)
                            polyline.outlinePaint.strokeWidth = TRACK_STROKE_WIDTH
                            view.overlays.add(polyline)
                        }
                    }

                    view.invalidate()
                },
            )

            // Download progress indicator
            if (uiState.isDownloading) {
                Card(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp)
                        .fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                        Text(
                            text = stringResource(R.string.downloading_tiles),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
    }

    // Layer selection bottom sheet
    if (showLayersSheet) {
        ModalBottomSheet(
            onDismissRequest = { showLayersSheet = false },
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.map_layers),
                    style = MaterialTheme.typography.titleMedium,
                )
                Spacer(Modifier.height(12.dp))

                LayerToggle(
                    label = stringResource(R.string.map_submissions),
                    checked = uiState.showSubmissions,
                    onCheckedChange = { viewModel.toggleSubmissions() },
                )
                LayerToggle(
                    label = stringResource(R.string.map_outbreaks),
                    checked = uiState.showOutbreaks,
                    onCheckedChange = { viewModel.toggleOutbreaks() },
                )
                LayerToggle(
                    label = stringResource(R.string.map_gps_tracks),
                    checked = uiState.showGpsTracks,
                    onCheckedChange = { viewModel.toggleGpsTracks() },
                )

                Spacer(Modifier.height(16.dp))

                // Tile storage info
                Text(
                    text = stringResource(R.string.tile_storage_size, uiState.tileStorageSize),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                if (uiState.tileStorageSize != "0 B") {
                    TextButton(onClick = { viewModel.deleteTiles() }) {
                        Text(stringResource(R.string.delete_tiles))
                    }
                }

                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun LayerToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            onCheckedChange = { onCheckedChange() },
        )
    }
}

private const val DEFAULT_ZOOM = 6.0
private const val AFRICA_CENTER_LAT = 1.0
private const val AFRICA_CENTER_LNG = 20.0
private const val TRACK_COLOR = "#1B5E20"
private const val TRACK_STROKE_WIDTH = 4f
