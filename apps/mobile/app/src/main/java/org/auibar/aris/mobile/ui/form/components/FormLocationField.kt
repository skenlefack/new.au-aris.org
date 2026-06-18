package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.auibar.aris.mobile.R
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

@Composable
fun FormLocationField(
    label: String,
    value: String,
    onCaptureLocation: () -> Unit,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    // Parse lat/lng from value (format: "lat, lng")
    val coords = remember(value) {
        if (value.isBlank()) return@remember null
        val parts = value.split(",").map { it.trim() }
        if (parts.size >= 2) {
            try {
                parts[0].toDouble() to parts[1].toDouble()
            } catch (_: Exception) { null }
        } else null
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
            Button(onClick = onCaptureLocation) {
                Icon(Icons.Default.MyLocation, contentDescription = stringResource(R.string.cd_capture_location))
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.capture_location))
            }
            if (value.isNotBlank()) {
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 12.dp),
                )
            }
        }

        // Mini map preview when coordinates are available
        if (coords != null) {
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
                        setMultiTouchControls(true)
                        controller.setZoom(15.0)
                        controller.setCenter(GeoPoint(coords.first, coords.second))

                        val marker = Marker(this)
                        marker.position = GeoPoint(coords.first, coords.second)
                        marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                        marker.title = label
                        overlays.add(marker)
                    }
                },
                update = { mapView ->
                    val point = GeoPoint(coords.first, coords.second)
                    mapView.controller.setCenter(point)
                    // Update marker
                    mapView.overlays.filterIsInstance<Marker>().firstOrNull()?.let {
                        it.position = point
                    }
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
}
