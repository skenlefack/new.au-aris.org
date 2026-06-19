package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.ui.form.model.SelectOption

@Composable
fun FormRadioField(
    label: String,
    value: String,
    options: List<SelectOption>,
    onValueChange: (String) -> Unit,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(
            text = if (required) "$label *" else label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        Column(modifier = Modifier.selectableGroup()) {
            options.forEach { option ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectable(
                            selected = value == option.value,
                            onClick = { onValueChange(option.value) },
                            role = Role.RadioButton,
                        )
                        .padding(vertical = 4.dp, horizontal = 8.dp),
                ) {
                    RadioButton(
                        selected = value == option.value,
                        onClick = null, // handled by row selectable
                    )
                    Text(
                        text = option.label,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }
        if (error != null) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 16.dp, top = 2.dp))
        }
    }
}
