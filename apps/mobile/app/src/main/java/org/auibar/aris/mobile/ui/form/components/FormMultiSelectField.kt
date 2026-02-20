package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.ui.form.model.SelectOption

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FormMultiSelectField(
    label: String,
    value: String,
    options: List<SelectOption>,
    onValueChange: (String) -> Unit,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    val selectedValues = if (value.isBlank()) emptySet()
        else value.split(",").toSet()

    Column(modifier = modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            text = if (required) "$label *" else label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            options.forEach { option ->
                val selected = option.value in selectedValues
                FilterChip(
                    selected = selected,
                    onClick = {
                        val newSet = if (selected) selectedValues - option.value
                            else selectedValues + option.value
                        onValueChange(newSet.joinToString(","))
                    },
                    label = { Text(option.label) },
                )
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
