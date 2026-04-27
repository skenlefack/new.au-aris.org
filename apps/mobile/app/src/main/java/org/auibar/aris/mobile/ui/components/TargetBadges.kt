package org.auibar.aris.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

data class TargetUiModel(
    val domainCode: String,
    val domainLabel: String,
    val subDomainCode: String? = null,
    val subDomainLabel: String? = null,
    val isPrimary: Boolean = false,
) {
    val displayBadge: String
        get() = if (subDomainLabel != null) "$domainLabel > $subDomainLabel" else domainLabel
}

@Composable
fun TargetBadges(
    targets: List<TargetUiModel>,
    maxVisible: Int = 2,
    modifier: Modifier = Modifier,
) {
    if (targets.isEmpty()) return

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val sortedTargets = targets.sortedByDescending { it.isPrimary }
        sortedTargets.take(maxVisible).forEach { target ->
            TargetBadge(target = target)
        }
        if (targets.size > maxVisible) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Text(
                    "+${targets.size - maxVisible}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun TargetBadge(target: TargetUiModel) {
    val (containerColor, contentColor) = if (target.isPrimary) {
        MaterialTheme.colorScheme.primary to MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = containerColor,
    ) {
        Text(
            text = target.displayBadge,
            style = MaterialTheme.typography.labelSmall,
            color = contentColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
