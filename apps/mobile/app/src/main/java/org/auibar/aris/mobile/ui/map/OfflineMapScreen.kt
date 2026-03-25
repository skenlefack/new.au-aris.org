package org.auibar.aris.mobile.ui.map

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.DashPathEffect
import android.view.ViewGroup
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.ArisSecondary
import org.auibar.aris.mobile.ui.theme.TrackGreen
import org.osmdroid.config.Configuration
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import org.osmdroid.views.overlay.ScaleBarOverlay
import org.osmdroid.views.overlay.compass.CompassOverlay
import org.osmdroid.views.overlay.compass.InternalCompassOrientationProvider
import org.osmdroid.views.overlay.mylocation.GpsMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // Persistent overlays that survive overlays.clear()
    var compassOverlay by remember { mutableStateOf<CompassOverlay?>(null) }
    var scaleBarOverlay by remember { mutableStateOf<ScaleBarOverlay?>(null) }
    var myLocationOverlay by remember { mutableStateOf<MyLocationNewOverlay?>(null) }

    // Track the current tile source applied to the MapView
    var appliedTileSource by remember { mutableStateOf(uiState.selectedTileSource) }

    // Location permission strings
    val locationPermissionMessage = stringResource(R.string.location_permission_required)

    // Location permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.any { it }) {
            // Permission granted — enable my location
            val mv = mapView ?: return@rememberLauncherForActivityResult
            val overlay = MyLocationNewOverlay(GpsMyLocationProvider(context), mv)
            overlay.enableMyLocation()
            overlay.enableFollowLocation()
            myLocationOverlay = overlay
            mv.overlays.add(overlay)
            mv.invalidate()
        } else {
            scope.launch { snackbarHostState.showSnackbar(locationPermissionMessage) }
        }
    }

    // Configure OSMDroid BEFORE MapView creation — synchronous
    DisposableEffect(Unit) {
        val config = Configuration.getInstance()
        config.userAgentValue = context.packageName
        config.osmdroidBasePath = context.filesDir
        config.osmdroidTileCache = context.cacheDir.resolve("osmdroid")
        onDispose {
            myLocationOverlay?.disableMyLocation()
            myLocationOverlay?.disableFollowLocation()
        }
    }

    // Animate to initial center when tenant resolves
    LaunchedEffect(uiState.initialCenter) {
        val center = uiState.initialCenter ?: return@LaunchedEffect
        val mv = mapView ?: return@LaunchedEffect
        mv.controller.animateTo(GeoPoint(center.lat, center.lng), uiState.initialZoom, 800L)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.offline_maps)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back_button),
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showLayersSheet = true }) {
                        Icon(Icons.Default.Layers, contentDescription = stringResource(R.string.map_layers))
                    }
                    IconButton(onClick = { viewModel.togglePresetPicker() }) {
                        Icon(Icons.Default.Map, contentDescription = stringResource(R.string.download_region_preset))
                    }
                    IconButton(
                        onClick = { viewModel.requestDownloadForVisibleRegion(mapView) },
                        enabled = !uiState.isDownloading,
                    ) {
                        Icon(Icons.Default.CloudDownload, contentDescription = stringResource(R.string.download_tiles))
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
            val mapDesc = stringResource(R.string.cd_map_view)
            val outbreakLabel = stringResource(R.string.outbreak)
            val trackColorArgb = remember { TrackGreen.toArgb() }
            val activeTrackColorArgb = remember { ArisSecondary.toArgb() }

            AndroidView(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { contentDescription = mapDesc },
                factory = { ctx ->
                    MapView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        setTileSource(uiState.selectedTileSource.toOsmTileSource())
                        setMultiTouchControls(true)
                        controller.setZoom(DEFAULT_ZOOM)
                        controller.setCenter(GeoPoint(AFRICA_CENTER_LAT, AFRICA_CENTER_LNG))

                        // Compass overlay
                        val compass = CompassOverlay(
                            ctx,
                            InternalCompassOrientationProvider(ctx),
                            this,
                        )
                        compass.enableCompass()
                        overlays.add(compass)
                        compassOverlay = compass

                        // Scale bar overlay
                        val scaleBar = ScaleBarOverlay(this)
                        scaleBar.setAlignBottom(true)
                        scaleBar.setAlignRight(false)
                        overlays.add(scaleBar)
                        scaleBarOverlay = scaleBar

                        mapView = this
                    }
                },
                update = { view ->
                    // Handle tile source change
                    if (appliedTileSource != uiState.selectedTileSource) {
                        view.setTileSource(uiState.selectedTileSource.toOsmTileSource())
                        appliedTileSource = uiState.selectedTileSource
                    }

                    // Toggle network usage based on connectivity
                    view.setUseDataConnection(true)

                    // Remove data overlays but preserve permanent ones
                    val permanent = listOfNotNull(compassOverlay, scaleBarOverlay, myLocationOverlay)
                    view.overlays.removeAll { it !in permanent }

                    // Re-add permanent overlays if missing
                    permanent.forEach { overlay ->
                        if (overlay !in view.overlays) {
                            view.overlays.add(overlay)
                        }
                    }

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
                            marker.snippet = outbreakLabel
                            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            view.overlays.add(marker)
                        }
                    }

                    // Completed GPS tracks (green solid)
                    if (uiState.showGpsTracks) {
                        uiState.gpsTracks.forEach { track ->
                            val polyline = Polyline()
                            polyline.setPoints(track.points.map { GeoPoint(it.lat, it.lng) })
                            polyline.outlinePaint.color = trackColorArgb
                            polyline.outlinePaint.strokeWidth = TRACK_STROKE_WIDTH
                            view.overlays.add(polyline)
                        }
                    }

                    // Active GPS track (amber dashed)
                    val activeTrack = uiState.activeGpsTrack
                    if (activeTrack != null && activeTrack.points.size >= 2) {
                        val polyline = Polyline()
                        polyline.setPoints(activeTrack.points.map { GeoPoint(it.lat, it.lng) })
                        polyline.outlinePaint.color = activeTrackColorArgb
                        polyline.outlinePaint.strokeWidth = ACTIVE_TRACK_STROKE_WIDTH
                        polyline.outlinePaint.pathEffect = DashPathEffect(floatArrayOf(20f, 10f), 0f)
                        view.overlays.add(polyline)

                        // Recording head marker at last point
                        val last = activeTrack.points.last()
                        val headMarker = Marker(view)
                        headMarker.position = GeoPoint(last.lat, last.lng)
                        headMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        headMarker.title = "Recording..."
                        view.overlays.add(headMarker)
                    }

                    view.invalidate()
                },
            )

            // GPS Recording indicator (top overlay)
            if (uiState.isTrackingActive && uiState.activeGpsTrack != null) {
                Card(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(8.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                    ),
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.FiberManualRecord,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(12.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = stringResource(
                                R.string.gps_recording_active,
                                uiState.activeGpsTrack?.points?.size ?: 0,
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                }
            }

            // My Location FAB
            FloatingActionButton(
                onClick = {
                    val hasPermission = ContextCompat.checkSelfPermission(
                        context, Manifest.permission.ACCESS_FINE_LOCATION,
                    ) == PackageManager.PERMISSION_GRANTED

                    if (hasPermission) {
                        val mv = mapView ?: return@FloatingActionButton
                        if (myLocationOverlay == null) {
                            val overlay = MyLocationNewOverlay(GpsMyLocationProvider(context), mv)
                            overlay.enableMyLocation()
                            overlay.enableFollowLocation()
                            myLocationOverlay = overlay
                            mv.overlays.add(overlay)
                            mv.invalidate()
                        } else {
                            myLocationOverlay?.enableFollowLocation()
                        }
                    } else {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION,
                            )
                        )
                    }
                },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
                    .semantics { contentDescription = context.getString(R.string.cd_my_location) },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
            ) {
                Icon(
                    Icons.Default.MyLocation,
                    contentDescription = stringResource(R.string.cd_my_location),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }

            // Download progress overlay
            if (uiState.isDownloading || uiState.downloadStatusText.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(start = 16.dp, end = 72.dp, bottom = 16.dp)
                        .fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        if (uiState.isDownloading) {
                            LinearProgressIndicator(
                                progress = { uiState.downloadProgress },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(8.dp))
                        }
                        Text(
                            text = uiState.downloadStatusText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }

    // Download confirmation dialog
    if (uiState.showDownloadConfirm && uiState.pendingEstimate != null) {
        val estimate = uiState.pendingEstimate!!
        AlertDialog(
            onDismissRequest = { viewModel.cancelDownload() },
            title = { Text(stringResource(R.string.download_confirm_title)) },
            text = {
                Column {
                    Text(stringResource(R.string.download_estimate_total, estimate.totalTiles))
                    Text(stringResource(R.string.download_estimate_cached, estimate.cachedTiles))
                    Text(stringResource(R.string.download_estimate_new, estimate.toDownload))
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.download_estimate_size, estimate.formattedSize),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.confirmDownload() }) {
                    Text(stringResource(R.string.confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelDownload() }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    // Layer selection bottom sheet
    if (showLayersSheet) {
        ModalBottomSheet(onDismissRequest = { showLayersSheet = false }) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(stringResource(R.string.map_layers), style = MaterialTheme.typography.titleMedium)
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

                // Map Style selector
                Spacer(Modifier.height(16.dp))
                Text(stringResource(R.string.map_style), style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))

                MapTileManager.MapTileSource.entries.forEach { source ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.selectTileSource(source) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = uiState.selectedTileSource == source,
                            onClick = { viewModel.selectTileSource(source) },
                        )
                        Text(
                            text = source.label,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                // Tile storage info
                Text(
                    text = stringResource(R.string.tile_storage_size, uiState.tileStorageSize),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "${uiState.tileCount} tiles cached",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (uiState.lastDownloadTime > 0) {
                    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault()) }
                    Text(
                        text = "Last download: ${dateFormat.format(Date(uiState.lastDownloadTime))}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Spacer(Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (uiState.tileStorageSize != "0 B") {
                        TextButton(onClick = { viewModel.pruneExpiredTiles() }) {
                            Icon(Icons.Default.DeleteSweep, contentDescription = null, modifier = Modifier.size(16.dp))
                            Text("Prune Old", modifier = Modifier.padding(start = 4.dp))
                        }
                        TextButton(onClick = { viewModel.deleteTiles() }) {
                            Text(stringResource(R.string.delete_tiles))
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))
            }
        }
    }

    // Region preset picker bottom sheet
    if (uiState.showPresetPicker) {
        ModalBottomSheet(onDismissRequest = { viewModel.togglePresetPicker() }) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.download_region_preset),
                    style = MaterialTheme.typography.titleMedium,
                )
                Spacer(Modifier.height(12.dp))
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.height(400.dp),
                ) {
                    items(uiState.regionPresets) { preset ->
                        val estimate = remember(preset, uiState.selectedTileSource) {
                            viewModel.let {
                                // Quick estimation for subtitle
                                val est = MapTileManager.TileEstimate(0, 0, 0)
                                est
                            }
                        }
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !uiState.isDownloading) {
                                    viewModel.downloadPreset(preset)
                                },
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Default.Map,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(24.dp),
                                )
                                Column(modifier = Modifier.padding(start = 12.dp)) {
                                    Text(
                                        text = preset.label,
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                    Text(
                                        text = "Zoom ${preset.minZoom}-${preset.maxZoom}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
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
        Switch(checked = checked, onCheckedChange = { onCheckedChange() })
    }
}

private const val DEFAULT_ZOOM = 6.0
private const val AFRICA_CENTER_LAT = 1.0
private const val AFRICA_CENTER_LNG = 20.0
private const val TRACK_STROKE_WIDTH = 4f
private const val ACTIVE_TRACK_STROKE_WIDTH = 5f
