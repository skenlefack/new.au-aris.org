package org.auibar.aris.mobile.ui.form

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
    onValueChange: (String, String) -> Unit,
    onCaptureLocation: () -> Unit,
    onTakePhoto: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        fields.forEach { field ->
            val value = values[field.key].orEmpty()
            val error = errors[field.key]

            when (field.type) {
                FormFieldType.TEXT -> FormTextField(
                    label = field.label,
                    value = value,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                    placeholder = field.placeholder,
                )
                FormFieldType.NUMBER -> FormNumberField(
                    label = field.label,
                    value = value,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                    placeholder = field.placeholder,
                )
                FormFieldType.DATE -> FormDateField(
                    label = field.label,
                    value = value,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                )
                FormFieldType.SELECT -> FormSelectField(
                    label = field.label,
                    value = value,
                    options = field.options,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                )
                FormFieldType.MULTI_SELECT -> FormMultiSelectField(
                    label = field.label,
                    value = value,
                    options = field.options,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                )
                FormFieldType.LOCATION -> FormLocationField(
                    label = field.label,
                    value = value,
                    onCaptureLocation = onCaptureLocation,
                    error = error,
                    required = field.required,
                )
                FormFieldType.SPECIES_SELECTOR -> SpeciesSelectorField(
                    label = field.label,
                    value = value,
                    speciesOptions = speciesOptions,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                )
                FormFieldType.DISEASE_SELECTOR -> DiseaseSelectorField(
                    label = field.label,
                    value = value,
                    diseaseOptions = diseaseOptions,
                    onValueChange = { onValueChange(field.key, it) },
                    error = error,
                    required = field.required,
                )
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
                    error = error,
                    required = field.required,
                )
                FormFieldType.PHOTO_CAPTURE -> PhotoCaptureField(
                    label = field.label,
                    value = value,
                    onTakePhoto = onTakePhoto,
                    error = error,
                    required = field.required,
                )
            }
        }
    }
}
