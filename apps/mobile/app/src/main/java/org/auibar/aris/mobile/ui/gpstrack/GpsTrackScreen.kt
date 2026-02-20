package org.auibar.aris.mobile.ui.gpstrack

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.repository.GpsTrack
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun GpsTrackScreen(
    campaignId: String? = null,
    viewModel: GpsTrackViewModel = hiltViewModel(),
) {
    val activeTrack by viewModel.activeTrack.collectAsStateWithLifecycle(initialValue = null)
    val allTracks by viewModel.allTracks.collectAsStateWithLifecycle(initialValue = emptyList())
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        // Active tracking card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = if (activeTrack != null) {
                CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            } else {
                CardDefaults.cardColors()
            },
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (activeTrack != null) {
                    val track = activeTrack!!
                    Text(
                        text = stringResource(R.string.tracking_active),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.track_points, track.pointCount),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        text = "%.1f m".format(track.distanceMeters),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { viewModel.stopTracking(context) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Icon(Icons.Default.Stop, contentDescription = null)
                        Text(
                            text = stringResource(R.string.stop_tracking),
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                } else {
                    Text(
                        text = stringResource(R.string.start_tracking),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { viewModel.startTracking(context, campaignId) },
                    ) {
                        Icon(Icons.Default.MyLocation, contentDescription = null)
                        Text(
                            text = stringResource(R.string.start_tracking),
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Previous tracks
        Text(
            text = stringResource(R.string.track_recorded),
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(8.dp))

        allTracks.filter { it.status != "RECORDING" }.forEach { track ->
            TrackItem(track = track)
            Spacer(modifier = Modifier.height(4.dp))
        }
    }
}

@Composable
private fun TrackItem(track: GpsTrack) {
    val dateFormat = SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault())

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = dateFormat.format(Date(track.startedAt)),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text = "${track.pointCount} pts | ${"%.0f".format(track.distanceMeters)} m",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = track.status,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
