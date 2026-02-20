package org.auibar.aris.mobile.ui.form.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import org.auibar.aris.mobile.ui.form.model.SelectOption

@Composable
fun DiseaseSelectorField(
    label: String,
    value: String,
    diseaseOptions: List<SelectOption>,
    onValueChange: (String) -> Unit,
    error: String?,
    required: Boolean,
    modifier: Modifier = Modifier,
) {
    FormSelectField(
        label = label,
        value = value,
        options = diseaseOptions,
        onValueChange = onValueChange,
        error = error,
        required = required,
        modifier = modifier,
    )
}
