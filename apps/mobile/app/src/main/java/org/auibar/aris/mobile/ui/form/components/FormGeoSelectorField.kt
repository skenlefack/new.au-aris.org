package org.auibar.aris.mobile.ui.form.components

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.android.gms.location.LocationServices
import org.auibar.aris.mobile.R
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon as OsmPolygon
import org.osmdroid.views.overlay.Polyline as OsmPolyline
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private const val MODE_POINT = "point"
private const val MODE_LINE = "polyline"
private const val MODE_POLYGON = "polygon"

@Composable
fun FormGeoSelectorField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    geoMode: String,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    var showPicker by remember { mutableStateOf(false) }

    // Determine available modes based on geoMode
    val availableModes = remember(geoMode) {
        when (geoMode.lowercase()) {
            "point" -> listOf(MODE_POINT)
            "polyline", "line" -> listOf(MODE_LINE)
            "polygon" -> listOf(MODE_POLYGON)
            else -> listOf(MODE_POINT, MODE_LINE, MODE_POLYGON) // selector = all modes
        }
    }

    // Parse existing value for preview info
    val previewText = remember(value) {
        if (value.isBlank()) return@remember null
        try {
            val geo = Json.parseToJsonElement(value).jsonObject
            when (geo["type"]?.jsonPrimitive?.content) {
                "Point" -> {
                    val coords = geo["coordinates"]?.jsonArray
                    if (coords != null && coords.size >= 2) {
                        val lng = coords[0].jsonPrimitive.double
                        val lat = coords[1].jsonPrimitive.double
                        "Point: %.5f, %.5f".format(lat, lng)
                    } else null
                }
                "LineString" -> {
                    val coords = geo["coordinates"]?.jsonArray
                    "Line: ${coords?.size ?: 0} points"
                }
                "Polygon" -> {
                    val rings = geo["coordinates"]?.jsonArray
                    val ring = rings?.firstOrNull()?.jsonArray
                    "Polygon: ${(ring?.size ?: 1) - 1} vertices"
                }
                else -> null
            }
        } catch (_: Exception) { null }
    }

    // Parse existing value to get a center point for mini-map preview
    val previewCenter = remember(value) {
        if (value.isBlank()) return@remember null
        try {
            val geo = Json.parseToJsonElement(value).jsonObject
            when (geo["type"]?.jsonPrimitive?.content) {
                "Point" -> {
                    val coords = geo["coordinates"]?.jsonArray
                    if (coords != null && coords.size >= 2) {
                        GeoPoint(coords[1].jsonPrimitive.double, coords[0].jsonPrimitive.double)
                    } else null
                }
                "LineString" -> {
                    val coords = geo["coordinates"]?.jsonArray
                    val first = coords?.firstOrNull()?.jsonArray
                    if (first != null && first.size >= 2) {
                        GeoPoint(first[1].jsonPrimitive.double, first[0].jsonPrimitive.double)
                    } else null
                }
                "Polygon" -> {
                    val ring = geo["coordinates"]?.jsonArray?.firstOrNull()?.jsonArray
                    val first = ring?.firstOrNull()?.jsonArray
                    if (first != null && first.size >= 2) {
                        GeoPoint(first[1].jsonPrimitive.double, first[0].jsonPrimitive.double)
                    } else null
                }
                else -> null
            }
        } catch (_: Exception) { null }
    }

    Column(modifier = modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            text = if (required) "$label *" else label,
            style = MaterialTheme.typography.bodyMedium,
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 4.dp),
        ) {
            Button(onClick = { showPicker = true }) {
                Icon(Icons.Default.MyLocation, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (value.isBlank()) "Select Location" else "Edit Location")
            }
            if (previewText != null) {
                Text(
                    text = previewText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 12.dp),
                )
            }
        }

        // Mini-map preview
        if (previewCenter != null) {
            Spacer(modifier = Modifier.height(8.dp))
            val mapShape = RoundedCornerShape(8.dp)
            AndroidView(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(mapShape)
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, mapShape),
                factory = { ctx ->
                    Configuration.getInstance().userAgentValue = ctx.packageName
                    MapView(ctx).apply {
                        setTileSource(TileSourceFactory.MAPNIK)
                        setMultiTouchControls(false)
                        controller.setZoom(14.0)
                        controller.setCenter(previewCenter)
                        applyGeoJsonOverlays(this, value, label)
                    }
                },
                update = { mapView ->
                    mapView.controller.setCenter(previewCenter)
                    mapView.overlays.clear()
                    applyGeoJsonOverlays(mapView, value, label)
                    mapView.invalidate()
                },
            )
            DisposableEffect(Unit) {
                onDispose { /* MapView cleanup handled by Android lifecycle */ }
            }
        }

        if (error != null) {
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(start = 16.dp, top = 2.dp),
            )
        }
    }

    // Full-screen map picker dialog
    if (showPicker) {
        GeoPickerDialog(
            initialValue = value,
            availableModes = availableModes,
            onDone = { geoJson ->
                onValueChange(geoJson)
                showPicker = false
            },
            onDismiss = { showPicker = false },
        )
    }
}

@Composable
private fun GeoPickerDialog(
    initialValue: String,
    availableModes: List<String>,
    onDone: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    var currentMode by remember { mutableStateOf(availableModes.first()) }

    // State for collected points
    val points = remember { mutableStateListOf<GeoPoint>() }
    var mapViewRef by remember { mutableStateOf<MapView?>(null) }

    // Initialize from existing GeoJSON value
    remember(initialValue) {
        if (initialValue.isBlank()) return@remember Unit
        try {
            val geo = Json.parseToJsonElement(initialValue).jsonObject
            val type = geo["type"]?.jsonPrimitive?.content
            when (type) {
                "Point" -> {
                    val coords = geo["coordinates"]?.jsonArray
                    if (coords != null && coords.size >= 2) {
                        points.clear()
                        points.add(GeoPoint(coords[1].jsonPrimitive.double, coords[0].jsonPrimitive.double))
                        currentMode = MODE_POINT
                    }
                }
                "LineString" -> {
                    val coords = geo["coordinates"]?.jsonArray
                    points.clear()
                    coords?.forEach { c ->
                        val arr = c.jsonArray
                        if (arr.size >= 2) points.add(GeoPoint(arr[1].jsonPrimitive.double, arr[0].jsonPrimitive.double))
                    }
                    currentMode = MODE_LINE
                }
                "Polygon" -> {
                    val ring = geo["coordinates"]?.jsonArray?.firstOrNull()?.jsonArray
                    points.clear()
                    ring?.dropLast(1)?.forEach { c ->
                        val arr = c.jsonArray
                        if (arr.size >= 2) points.add(GeoPoint(arr[1].jsonPrimitive.double, arr[0].jsonPrimitive.double))
                    }
                    currentMode = MODE_POLYGON
                }
            }
        } catch (_: Exception) {}
        Unit
    }

    fun updateMapOverlays(mapView: MapView) {
        mapView.overlays.removeAll { it !is MapEventsOverlay }
        when (currentMode) {
            MODE_POINT -> {
                if (points.isNotEmpty()) {
                    val marker = Marker(mapView)
                    marker.position = points.last()
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    marker.title = "Selected Point"
                    mapView.overlays.add(marker)
                }
            }
            MODE_LINE -> {
                points.forEachIndexed { idx, pt ->
                    val marker = Marker(mapView)
                    marker.position = pt
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    marker.title = "Point ${idx + 1}"
                    mapView.overlays.add(marker)
                }
                if (points.size >= 2) {
                    val line = OsmPolyline()
                    line.setPoints(points.toList())
                    line.outlinePaint.color = AndroidColor.BLUE
                    line.outlinePaint.strokeWidth = 5f
                    mapView.overlays.add(line)
                }
            }
            MODE_POLYGON -> {
                points.forEach { pt ->
                    val marker = Marker(mapView)
                    marker.position = pt
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    mapView.overlays.add(marker)
                }
                if (points.size >= 3) {
                    val polygon = OsmPolygon()
                    val ring = points.toMutableList()
                    ring.add(ring.first()) // close the ring
                    polygon.points = ring
                    polygon.fillPaint.color = AndroidColor.argb(50, 0, 0, 255)
                    polygon.outlinePaint.color = AndroidColor.BLUE
                    polygon.outlinePaint.strokeWidth = 3f
                    mapView.overlays.add(polygon)
                }
            }
        }
        mapView.invalidate()
    }

    fun buildGeoJson(): String {
        return when (currentMode) {
            MODE_POINT -> {
                val pt = points.lastOrNull() ?: return ""
                JsonObject(mapOf(
                    "type" to JsonPrimitive("Point"),
                    "coordinates" to JsonArray(listOf(JsonPrimitive(pt.longitude), JsonPrimitive(pt.latitude))),
                )).toString()
            }
            MODE_LINE -> {
                if (points.size < 2) return ""
                val coords = JsonArray(points.map { pt ->
                    JsonArray(listOf(JsonPrimitive(pt.longitude), JsonPrimitive(pt.latitude)))
                })
                JsonObject(mapOf(
                    "type" to JsonPrimitive("LineString"),
                    "coordinates" to coords,
                )).toString()
            }
            MODE_POLYGON -> {
                if (points.size < 3) return ""
                val ring = points.toMutableList()
                ring.add(ring.first()) // close
                val coords = JsonArray(ring.map { pt ->
                    JsonArray(listOf(JsonPrimitive(pt.longitude), JsonPrimitive(pt.latitude)))
                })
                JsonObject(mapOf(
                    "type" to JsonPrimitive("Polygon"),
                    "coordinates" to JsonArray(listOf(coords)),
                )).toString()
            }
            else -> ""
        }
    }

    fun centerOnMyLocation() {
        try {
            val fusedClient = LocationServices.getFusedLocationProviderClient(context)
            fusedClient.lastLocation.addOnSuccessListener { loc ->
                if (loc != null) {
                    mapViewRef?.controller?.animateTo(GeoPoint(loc.latitude, loc.longitude))
                }
            }
        } catch (_: SecurityException) {
            // Permission not granted — ignore silently
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Map
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        Configuration.getInstance().userAgentValue = ctx.packageName
                        MapView(ctx).apply {
                            setTileSource(TileSourceFactory.MAPNIK)
                            setMultiTouchControls(true)
                            controller.setZoom(6.0)
                            controller.setCenter(GeoPoint(1.0, 20.0)) // Center of Africa

                            // Center on existing points if any
                            if (points.isNotEmpty()) {
                                controller.setZoom(14.0)
                                controller.setCenter(points.first())
                            }

                            val eventsOverlay = MapEventsOverlay(object : MapEventsReceiver {
                                override fun singleTapConfirmedHelper(p: GeoPoint?): Boolean {
                                    if (p == null) return false
                                    when (currentMode) {
                                        MODE_POINT -> {
                                            points.clear()
                                            points.add(p)
                                        }
                                        MODE_LINE, MODE_POLYGON -> {
                                            points.add(p)
                                        }
                                    }
                                    updateMapOverlays(this@apply)
                                    return true
                                }

                                override fun longPressHelper(p: GeoPoint?): Boolean = false
                            })
                            overlays.add(0, eventsOverlay)
                            mapViewRef = this
                            updateMapOverlays(this)
                        }
                    },
                    update = { mapView ->
                        mapViewRef = mapView
                    },
                )

                // Mode selector chips at top
                if (availableModes.size > 1) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 16.dp, start = 16.dp, end = 16.dp)
                            .align(Alignment.TopCenter),
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        availableModes.forEach { mode ->
                            FilterChip(
                                selected = currentMode == mode,
                                onClick = {
                                    currentMode = mode
                                    points.clear()
                                    mapViewRef?.let { updateMapOverlays(it) }
                                },
                                label = {
                                    Text(
                                        when (mode) {
                                            MODE_POINT -> "Point"
                                            MODE_LINE -> "Line"
                                            MODE_POLYGON -> "Polygon"
                                            else -> mode
                                        }
                                    )
                                },
                                modifier = Modifier.padding(horizontal = 4.dp),
                            )
                        }
                    }
                }

                // Info text
                if (points.isNotEmpty()) {
                    val infoText = when (currentMode) {
                        MODE_POINT -> {
                            val pt = points.last()
                            "%.5f, %.5f".format(pt.latitude, pt.longitude)
                        }
                        MODE_LINE -> {
                            val totalDist = if (points.size >= 2) {
                                var dist = 0.0
                                for (i in 0 until points.size - 1) {
                                    dist += points[i].distanceToAsDouble(points[i + 1])
                                }
                                "%.0f m".format(dist)
                            } else ""
                            "${points.size} points${if (totalDist.isNotBlank()) " - $totalDist" else ""}"
                        }
                        MODE_POLYGON -> "${points.size} vertices"
                        else -> ""
                    }
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = if (availableModes.size > 1) 64.dp else 16.dp),
                    ) {
                        Text(
                            text = infoText,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }

                // My Location FAB
                FloatingActionButton(
                    onClick = { centerOnMyLocation() },
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 16.dp, bottom = 80.dp),
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Icon(Icons.Default.MyLocation, contentDescription = "My Location")
                }

                // Bottom action bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    TextButton(onClick = {
                        points.clear()
                        mapViewRef?.let { updateMapOverlays(it) }
                    }) {
                        Icon(Icons.Default.Clear, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.clear))
                    }
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.cancel))
                    }
                    Button(
                        onClick = {
                            val geoJson = buildGeoJson()
                            onDone(geoJson)
                        },
                        colors = ButtonDefaults.buttonColors(),
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.done))
                    }
                }
            }
        }
    }
}

/** Apply GeoJSON overlays to a MapView for preview purposes. */
private fun applyGeoJsonOverlays(mapView: MapView, geoJsonString: String, label: String) {
    if (geoJsonString.isBlank()) return
    try {
        val geo = Json.parseToJsonElement(geoJsonString).jsonObject
        when (geo["type"]?.jsonPrimitive?.content) {
            "Point" -> {
                val coords = geo["coordinates"]?.jsonArray ?: return
                if (coords.size >= 2) {
                    val marker = Marker(mapView)
                    marker.position = GeoPoint(coords[1].jsonPrimitive.double, coords[0].jsonPrimitive.double)
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    marker.title = label
                    mapView.overlays.add(marker)
                }
            }
            "LineString" -> {
                val coords = geo["coordinates"]?.jsonArray ?: return
                val pts = coords.mapNotNull { c ->
                    val arr = c.jsonArray
                    if (arr.size >= 2) GeoPoint(arr[1].jsonPrimitive.double, arr[0].jsonPrimitive.double) else null
                }
                pts.forEach { pt ->
                    val marker = Marker(mapView)
                    marker.position = pt
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    mapView.overlays.add(marker)
                }
                if (pts.size >= 2) {
                    val line = OsmPolyline()
                    line.setPoints(pts)
                    line.outlinePaint.color = AndroidColor.BLUE
                    line.outlinePaint.strokeWidth = 5f
                    mapView.overlays.add(line)
                }
            }
            "Polygon" -> {
                val ring = geo["coordinates"]?.jsonArray?.firstOrNull()?.jsonArray ?: return
                val pts = ring.mapNotNull { c ->
                    val arr = c.jsonArray
                    if (arr.size >= 2) GeoPoint(arr[1].jsonPrimitive.double, arr[0].jsonPrimitive.double) else null
                }
                if (pts.size >= 3) {
                    val polygon = OsmPolygon()
                    polygon.points = pts.toMutableList()
                    polygon.fillPaint.color = AndroidColor.argb(50, 0, 0, 255)
                    polygon.outlinePaint.color = AndroidColor.BLUE
                    polygon.outlinePaint.strokeWidth = 3f
                    mapView.overlays.add(polygon)
                }
            }
        }
    } catch (_: Exception) {}
}
