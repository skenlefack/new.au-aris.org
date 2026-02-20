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

@Composable
fun AdminCascaderField(
    label: String,
    countryValue: String,
    admin1Value: String,
    admin2Value: String,
    countryOptions: List<SelectOption>,
    admin1Options: List<SelectOption>,
    admin2Options: List<SelectOption>,
    onCountryChange: (String) -> Unit,
    onAdmin1Change: (String) -> Unit,
    onAdmin2Change: (String) -> Unit,
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
        FormSelectField(
            label = stringResource(R.string.select_country),
            value = countryValue,
            options = countryOptions,
            onValueChange = onCountryChange,
            error = null,
            required = required,
        )
        if (countryValue.isNotBlank()) {
            FormSelectField(
                label = stringResource(R.string.select_admin1),
                value = admin1Value,
                options = admin1Options,
                onValueChange = onAdmin1Change,
                error = null,
                required = false,
            )
        }
        if (admin1Value.isNotBlank()) {
            FormSelectField(
                label = stringResource(R.string.select_admin2),
                value = admin2Value,
                options = admin2Options,
                onValueChange = onAdmin2Change,
                error = null,
                required = false,
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
