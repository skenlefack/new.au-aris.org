package org.auibar.aris.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudQueue
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.auibar.aris.mobile.R

@Composable
fun SyncStatusBar(
    isOffline: Boolean,
    pendingCount: Int,
    lastSyncTime: Long?,
    isSyncing: Boolean,
    onSyncNow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Show bar when: offline OR has pending submissions OR currently syncing
    val visible = isOffline || pendingCount > 0 || isSyncing

    AnimatedVisibility(
        visible = visible,
        enter = expandVertically(),
        exit = shrinkVertically(),
        modifier = modifier,
    ) {
        val bgColor = if (isOffline) MaterialTheme.colorScheme.errorContainer
                      else MaterialTheme.colorScheme.primaryContainer
        val contentColor = if (isOffline) MaterialTheme.colorScheme.onErrorContainer
                           else MaterialTheme.colorScheme.onPrimaryContainer

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(bgColor)
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Icon
            Icon(
                imageVector = if (isOffline) Icons.Default.CloudOff else Icons.Default.CloudQueue,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = contentColor,
            )
            Spacer(Modifier.width(8.dp))

            // Status text
            Column(modifier = Modifier.weight(1f)) {
                if (isOffline) {
                    Text(
                        stringResource(R.string.sync_status_offline),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = contentColor,
                    )
                }
                Row {
                    if (pendingCount > 0) {
                        Text(
                            stringResource(R.string.sync_status_pending, pendingCount),
                            style = MaterialTheme.typography.labelSmall,
                            color = contentColor.copy(alpha = 0.8f),
                        )
                        Text(" · ", color = contentColor.copy(alpha = 0.5f), style = MaterialTheme.typography.labelSmall)
                    }
                    Text(
                        formatLastSync(lastSyncTime),
                        style = MaterialTheme.typography.labelSmall,
                        color = contentColor.copy(alpha = 0.7f),
                    )
                }
            }

            // Sync button (only when online)
            if (!isOffline) {
                if (isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = contentColor,
                    )
                } else {
                    Icon(
                        Icons.Default.Sync,
                        contentDescription = stringResource(R.string.sync_now),
                        modifier = Modifier
                            .size(20.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .clickable(onClick = onSyncNow)
                            .padding(2.dp),
                        tint = contentColor,
                    )
                }
            }
        }
    }
}

private fun formatLastSync(epochMs: Long?): String {
    if (epochMs == null || epochMs == 0L) return "Never synced"
    val diff = System.currentTimeMillis() - epochMs
    return when {
        diff < 60_000 -> "Synced just now"
        diff < 3600_000 -> "Synced ${diff / 60_000}m ago"
        diff < 86400_000 -> "Synced ${diff / 3600_000}h ago"
        else -> "Synced ${diff / 86400_000}d ago"
    }
}
