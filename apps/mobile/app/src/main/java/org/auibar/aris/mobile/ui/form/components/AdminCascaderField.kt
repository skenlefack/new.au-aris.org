package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.form.model.SelectOption

/**
 * Administrative location cascade: country, then the levels configured for that country
 * (Settings > Countries on the web), each named as configured there.
 * A level is shown once its parent is selected.
 */
@Composable
fun AdminCascaderField(
    label: String,
    levels: List<Int>,
    levelLabels: Map<Int, String>,
    values: Map<Int, String>,
    options: Map<Int, List<SelectOption>>,
    onLevelChange: (Int, String) -> Unit,
    requiredLevels: Set<Int>,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            text = if (required) "$label *" else label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        val sorted = levels.sorted()
        sorted.forEachIndexed { idx, level ->
            val parent = sorted.getOrNull(idx - 1)
            if (parent != null && values[parent].isNullOrBlank()) return@forEachIndexed
            val levelLabel = when {
                level == 0 -> stringResource(R.string.select_country)
                levelLabels[level] != null -> levelLabels.getValue(level)
                else -> stringResource(R.string.admin_level_n, level)
            }
            FormSelectField(
                label = levelLabel,
                value = values[level].orEmpty(),
                options = options[level].orEmpty(),
                onValueChange = { onLevelChange(level, it) },
                error = null,
                required = level in requiredLevels,
            )
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
