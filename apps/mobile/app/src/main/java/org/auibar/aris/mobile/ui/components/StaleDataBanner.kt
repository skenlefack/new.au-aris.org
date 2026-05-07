package org.auibar.aris.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.R

private val WarningBg = Color(0xFFFFF3E0) // light amber
private val WarningFg = Color(0xFFE65100)

/**
 * Shows a warning banner when cached data is older than expected.
 * @param lastRefreshMs epoch millis of last refresh, null = never refreshed
 * @param staleTtlMs threshold in millis after which data is considered stale
 */
@Composable
fun StaleDataBanner(
    lastRefreshMs: Long?,
    staleTtlMs: Long,
    modifier: Modifier = Modifier,
) {
    val isStale = lastRefreshMs == null ||
        (System.currentTimeMillis() - lastRefreshMs) > staleTtlMs

    AnimatedVisibility(
        visible = isStale && lastRefreshMs != null && lastRefreshMs > 0,
        enter = expandVertically(),
        exit = shrinkVertically(),
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(WarningBg)
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = WarningFg,
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.stale_data_warning, formatAge(lastRefreshMs ?: 0)),
                style = MaterialTheme.typography.labelSmall,
                color = WarningFg,
            )
        }
    }
}

private fun formatAge(epochMs: Long): String {
    val diff = System.currentTimeMillis() - epochMs
    return when {
        diff < 3600_000 -> "${diff / 60_000}m"
        diff < 86400_000 -> "${diff / 3600_000}h"
        else -> "${diff / 86400_000}d"
    }
}
