package org.auibar.aris.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.remember
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncIndicator(
    pendingCount: Int,
    lastSyncAt: Long?,
    modifier: Modifier = Modifier,
) {
    val justNow = stringResource(R.string.just_now)
    val minsAgo = stringResource(R.string.minutes_ago, ((System.currentTimeMillis() - (lastSyncAt ?: 0)) / 60_000).toInt())
    val hoursAgo = stringResource(R.string.hours_ago, ((System.currentTimeMillis() - (lastSyncAt ?: 0)) / 3_600_000).toInt())
    val dateFormat = remember { SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()) }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (lastSyncAt != null) {
            Text(
                text = formatSyncTime(lastSyncAt, justNow, minsAgo, hoursAgo, dateFormat),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        BadgedBox(
            badge = {
                if (pendingCount > 0) {
                    Badge { Text("$pendingCount") }
                }
            }
        ) {
            Icon(
                imageVector = when {
                    pendingCount > 0 -> Icons.Default.CloudUpload
                    lastSyncAt != null -> Icons.Default.CloudDone
                    else -> Icons.Default.CloudOff
                },
                contentDescription = stringResource(R.string.cd_sync_status, if (pendingCount > 0) "$pendingCount" else ""),
                tint = if (pendingCount > 0) SyncPending else SyncSuccess,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

private fun formatSyncTime(timestamp: Long, justNow: String, minsAgo: String, hoursAgo: String, dateFormat: SimpleDateFormat): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    return when {
        diff < 60_000 -> justNow
        diff < 3_600_000 -> minsAgo
        diff < 86_400_000 -> hoursAgo
        else -> dateFormat.format(Date(timestamp))
    }
}
