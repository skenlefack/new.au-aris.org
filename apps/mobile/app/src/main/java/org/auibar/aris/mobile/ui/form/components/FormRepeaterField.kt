package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType

@Composable
fun FormRepeaterField(
    label: String,
    repeaterFields: List<FormField>,
    values: Map<String, String>,
    errors: Map<String, String>,
    onValueChange: (String, String) -> Unit,
    required: Boolean,
    minRows: Int,
    maxRows: Int,
    fieldKey: String,
    modifier: Modifier = Modifier,
) {
    // Determine current row count from values — look for keys like "fieldKey.0.subField"
    val rowCount = remember(values, fieldKey) {
        val pattern = Regex("^${Regex.escape(fieldKey)}\\.(\\d+)\\.")
        val indices = values.keys.mapNotNull { key ->
            pattern.find(key)?.groupValues?.get(1)?.toIntOrNull()
        }.toSet()
        if (indices.isEmpty()) maxOf(minRows, 1) else indices.max() + 1
    }

    Column(modifier = modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(
            text = if (required) "$label *" else label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        for (rowIndex in 0 until rowCount) {
            Card(
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = "Row ${rowIndex + 1}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        if (rowCount > minRows) {
                            IconButton(onClick = {
                                // Remove all values for this row and shift subsequent rows down
                                val keysToRemove = values.keys.filter {
                                    it.startsWith("$fieldKey.$rowIndex.")
                                }
                                keysToRemove.forEach { key ->
                                    onValueChange(key, "")
                                }
                                // Signal removal by setting a meta key
                                onValueChange("$fieldKey.__removeRow", rowIndex.toString())
                            }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Remove row",
                                    tint = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                    }

                    repeaterFields.forEach { subField ->
                        val subKey = "$fieldKey.$rowIndex.${subField.key}"
                        val subValue = values[subKey].orEmpty()
                        val subError = errors[subKey]

                        when (subField.type) {
                            FormFieldType.TEXT -> FormTextField(
                                label = subField.label,
                                value = subValue,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                                placeholder = subField.placeholder,
                            )
                            FormFieldType.TEXTAREA -> FormTextareaField(
                                label = subField.label,
                                value = subValue,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                                placeholder = subField.placeholder,
                                rows = subField.rows,
                            )
                            FormFieldType.NUMBER -> FormNumberField(
                                label = subField.label,
                                value = subValue,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                                placeholder = subField.placeholder,
                            )
                            FormFieldType.DATE -> FormDateField(
                                label = subField.label,
                                value = subValue,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                            )
                            FormFieldType.SELECT -> FormSelectField(
                                label = subField.label,
                                value = subValue,
                                options = subField.options,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                            )
                            FormFieldType.TOGGLE -> FormToggleField(
                                label = subField.label,
                                value = subValue,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                            )
                            FormFieldType.RADIO -> FormRadioField(
                                label = subField.label,
                                value = subValue,
                                options = subField.options,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                            )
                            else -> FormTextField(
                                label = subField.label,
                                value = subValue,
                                onValueChange = { onValueChange(subKey, it) },
                                error = subError,
                                required = subField.required,
                                placeholder = subField.placeholder,
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        if (rowCount < maxRows) {
            OutlinedButton(
                onClick = {
                    // Initialize an empty value for the first sub-field of the new row to register it
                    val firstSubField = repeaterFields.firstOrNull() ?: return@OutlinedButton
                    val newRowKey = "$fieldKey.$rowCount.${firstSubField.key}"
                    onValueChange(newRowKey, firstSubField.defaultValue ?: "")
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                Text(stringResource(R.string.add_row))
            }
        }
    }
}
