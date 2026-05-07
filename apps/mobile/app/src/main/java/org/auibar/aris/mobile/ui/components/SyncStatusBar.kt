package org.auibar.aris.mobile.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.auibar.aris.mobile.R

private val OnlineGreen = Color(0xFF1B5E20)
private val OnlineBg = Color(0xFFE8F5E9)
private val OfflineRed = Color(0xFFC62828)
private val OfflineBg = Color(0xFFFFEBEE)
private val PendingAmber = Color(0xFFE65100)
private val PendingBg = Color(0xFFFFF3E0)

@Composable
fun SyncStatusBar(
    isOffline: Boolean,
    pendingCount: Int,
    lastSyncTime: Long?,
    isSyncing: Boolean,
    onSyncNow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bgColor by animateColorAsState(
        targetValue = when {
            isOffline -> OfflineBg
            pendingCount > 0 -> PendingBg
            else -> OnlineBg
        },
        label = "syncBarBg",
    )
    val fgColor = when {
        isOffline -> OfflineRed
        pendingCount > 0 -> PendingAmber
        else -> OnlineGreen
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(bgColor)
            .padding(horizontal = 12.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Status dot (pulsing feel via color)
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(fgColor),
        )
        Spacer(Modifier.width(8.dp))

        // Icon
        Icon(
            imageVector = if (isOffline) Icons.Default.CloudOff else Icons.Default.CloudDone,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = fgColor,
        )
        Spacer(Modifier.width(6.dp))

        // Status text
        Text(
            text = when {
                isOffline -> stringResource(R.string.sync_status_offline)
                isSyncing -> stringResource(R.string.sync_status_syncing)
                pendingCount > 0 -> stringResource(R.string.sync_status_pending, pendingCount)
                else -> stringResource(R.string.sync_status_online)
            },
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
            fontWeight = FontWeight.SemiBold,
            color = fgColor,
        )

        // Last sync time
        if (!isOffline && lastSyncTime != null && lastSyncTime > 0) {
            Text(
                text = " · ${formatLastSync(lastSyncTime)}",
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                color = fgColor.copy(alpha = 0.6f),
            )
        }

        Spacer(Modifier.weight(1f))

        // Sync button or spinner
        if (isSyncing) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                strokeWidth = 1.5.dp,
                color = fgColor,
            )
        } else if (!isOffline && pendingCount > 0) {
            Icon(
                Icons.Default.Sync,
                contentDescription = stringResource(R.string.sync_now),
                modifier = Modifier
                    .size(18.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .clickable(onClick = onSyncNow)
                    .padding(2.dp),
                tint = fgColor,
            )
        }
    }
}

private fun formatLastSync(epochMs: Long): String {
    val diff = System.currentTimeMillis() - epochMs
    return when {
        diff < 60_000 -> "just now"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        diff < 86400_000 -> "${diff / 3600_000}h ago"
        else -> "${diff / 86400_000}d ago"
    }
}
