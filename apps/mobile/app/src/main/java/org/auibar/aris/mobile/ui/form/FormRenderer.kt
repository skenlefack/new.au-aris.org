package org.auibar.aris.mobile.ui.form

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.ui.form.components.AdminCascaderField
import org.auibar.aris.mobile.ui.form.components.DiseaseSelectorField
import org.auibar.aris.mobile.ui.form.components.FormDateField
import org.auibar.aris.mobile.ui.form.components.FormLocationField
import org.auibar.aris.mobile.ui.form.components.FormMultiSelectField
import org.auibar.aris.mobile.ui.form.components.FormNumberField
import org.auibar.aris.mobile.ui.form.components.FormSelectField
import org.auibar.aris.mobile.ui.form.components.FormTextField
import org.auibar.aris.mobile.ui.form.components.PhotoCaptureField
import org.auibar.aris.mobile.ui.form.components.SpeciesSelectorField
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption

@Composable
fun FormRenderer(
    fields: List<FormField>,
    values: Map<String, String>,
    errors: Map<String, String>,
    speciesOptions: List<SelectOption>,
    diseaseOptions: List<SelectOption>,
    countryOptions: List<SelectOption>,
    admin1Options: List<SelectOption>,
    admin2Options: List<SelectOption>,
    masterDataOptions: Map<String, List<SelectOption>> = emptyMap(),
    onValueChange: (String, String) -> Unit,
    onCaptureLocation: () -> Unit,
    onTakePhoto: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Group fields by section
    val sections = fields.groupBy { it.sectionName ?: "" }

    Column(modifier = modifier.fillMaxWidth()) {
        sections.forEach { (sectionName, sectionFields) ->
            // Section header
            if (sectionName.isNotBlank()) {
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Text(
                        sectionName,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.height(4.dp))
            }

            sectionFields.forEach { field ->
                val value = values[field.key].orEmpty()
                val error = errors[field.key]

                when (field.type) {
                    FormFieldType.TEXT -> FormTextField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                        placeholder = field.placeholder,
                    )
                    FormFieldType.NUMBER -> FormNumberField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                        placeholder = field.placeholder,
                    )
                    FormFieldType.DATE -> FormDateField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                    )
                    FormFieldType.SELECT -> {
                        // Use masterDataOptions if this is a master-data-select field
                        val options = if (field.masterDataType != null) {
                            masterDataOptions[field.masterDataType] ?: field.options
                        } else {
                            field.options
                        }
                        FormSelectField(
                            label = field.label, value = value, options = options,
                            onValueChange = { onValueChange(field.key, it) },
                            error = error, required = field.required,
                        )
                    }
                    FormFieldType.MULTI_SELECT -> {
                        val options = if (field.masterDataType != null) {
                            masterDataOptions[field.masterDataType] ?: field.options
                        } else {
                            field.options
                        }
                        FormMultiSelectField(
                            label = field.label, value = value, options = options,
                            onValueChange = { onValueChange(field.key, it) },
                            error = error, required = field.required,
                        )
                    }
                    FormFieldType.LOCATION -> FormLocationField(
                        label = field.label, value = value,
                        onCaptureLocation = onCaptureLocation,
                        error = error, required = field.required,
                    )
                    FormFieldType.SPECIES_SELECTOR -> {
                        val options = masterDataOptions["species"] ?: speciesOptions
                        FormSelectField(
                            label = field.label, value = value, options = options,
                            onValueChange = { onValueChange(field.key, it) },
                            error = error, required = field.required,
                        )
                    }
                    FormFieldType.DISEASE_SELECTOR -> {
                        val options = masterDataOptions["diseases"] ?: diseaseOptions
                        FormSelectField(
                            label = field.label, value = value, options = options,
                            onValueChange = { onValueChange(field.key, it) },
                            error = error, required = field.required,
                        )
                    }
                    FormFieldType.ADMIN_CASCADER -> AdminCascaderField(
                        label = field.label,
                        countryValue = values["_country"].orEmpty(),
                        admin1Value = values["_admin1"].orEmpty(),
                        admin2Value = values["_admin2"].orEmpty(),
                        countryOptions = countryOptions,
                        admin1Options = admin1Options,
                        admin2Options = admin2Options,
                        onCountryChange = { onValueChange("_country", it) },
                        onAdmin1Change = { onValueChange("_admin1", it) },
                        onAdmin2Change = { onValueChange("_admin2", it) },
                        error = error, required = field.required,
                    )
                    FormFieldType.PHOTO_CAPTURE -> PhotoCaptureField(
                        label = field.label, value = value,
                        onTakePhoto = onTakePhoto,
                        error = error, required = field.required,
                    )
                }
            }
        }
    }
}
