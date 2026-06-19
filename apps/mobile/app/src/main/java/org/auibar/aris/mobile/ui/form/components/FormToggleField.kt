package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun FormToggleField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    val checked = value == "true"
    Column(modifier = modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = if (required) "$label *" else label,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            Spacer(modifier = Modifier.padding(horizontal = 8.dp))
            Switch(
                checked = checked,
                onCheckedChange = { onValueChange(if (it) "true" else "false") },
            )
        }
        if (error != null) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 16.dp, top = 2.dp))
        }
    }
}
