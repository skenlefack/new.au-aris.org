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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.ui.form.components.AdminCascaderField
import org.auibar.aris.mobile.ui.form.components.DiseaseSelectorField
import org.auibar.aris.mobile.ui.form.components.FormDateField
import org.auibar.aris.mobile.ui.form.components.FormDividerField
import org.auibar.aris.mobile.ui.form.components.FormGeoSelectorField
import org.auibar.aris.mobile.ui.form.components.FormHeadingField
import org.auibar.aris.mobile.ui.form.components.FormInfoBoxField
import org.auibar.aris.mobile.ui.form.components.FormLocationField
import org.auibar.aris.mobile.ui.form.components.FormMultiSelectField
import org.auibar.aris.mobile.ui.form.components.FormNumberField
import org.auibar.aris.mobile.ui.form.components.FormRadioField
import org.auibar.aris.mobile.ui.form.components.FormRepeaterField
import org.auibar.aris.mobile.ui.form.components.FormSelectField
import org.auibar.aris.mobile.ui.form.components.FormTextField
import org.auibar.aris.mobile.ui.form.components.FormTextareaField
import org.auibar.aris.mobile.ui.form.components.FormToggleField
import org.auibar.aris.mobile.ui.form.components.PhotoCaptureField
import org.auibar.aris.mobile.ui.form.components.SpeciesSelectorField
import org.auibar.aris.mobile.ui.form.model.FieldCondition
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
                    Column {
                        Text(
                            sectionName,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        // Show section description from the first field that has one
                        val sectionDesc = sectionFields.firstOrNull { !it.sectionDescription.isNullOrBlank() }?.sectionDescription
                        if (!sectionDesc.isNullOrBlank()) {
                            Text(
                                sectionDesc,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
            }

            sectionFields.forEach { field ->
                // Check field visibility conditions
                if (field.hidden) return@forEach
                if (field.conditions.isNotEmpty()) {
                    val visible = evaluateConditions(field.conditions, field.conditionLogic, values)
                    if (!visible) return@forEach
                }

                val value = values[field.key].orEmpty()
                val error = errors[field.key]

                when (field.type) {
                    FormFieldType.TEXT -> FormTextField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                        placeholder = field.placeholder,
                    )
                    FormFieldType.TEXTAREA -> FormTextareaField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                        placeholder = field.placeholder,
                        rows = field.rows,
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
                    FormFieldType.TIME -> FormTextField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                        placeholder = field.placeholder ?: "HH:MM",
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
                    FormFieldType.RADIO -> {
                        val options = if (field.masterDataType != null) {
                            masterDataOptions[field.masterDataType] ?: field.options
                        } else {
                            field.options
                        }
                        FormRadioField(
                            label = field.label, value = value, options = options,
                            onValueChange = { onValueChange(field.key, it) },
                            error = error, required = field.required,
                        )
                    }
                    FormFieldType.TOGGLE -> FormToggleField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                    )
                    FormFieldType.LOCATION -> FormLocationField(
                        label = field.label, value = value,
                        onCaptureLocation = onCaptureLocation,
                        error = error, required = field.required,
                    )
                    FormFieldType.GEO_SELECTOR -> FormGeoSelectorField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        geoMode = field.geoMode,
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
                    FormFieldType.FILE_UPLOAD -> PhotoCaptureField(
                        label = field.label, value = value,
                        onTakePhoto = onTakePhoto,
                        error = error, required = field.required,
                    )
                    FormFieldType.HEADING -> FormHeadingField(label = field.label)
                    FormFieldType.INFO_BOX -> FormInfoBoxField(
                        label = field.label,
                        description = field.description,
                    )
                    FormFieldType.DIVIDER -> FormDividerField()
                    FormFieldType.REPEATER -> FormRepeaterField(
                        label = field.label,
                        repeaterFields = field.repeaterFields,
                        values = values,
                        errors = errors,
                        onValueChange = onValueChange,
                        required = field.required,
                        minRows = field.minRows,
                        maxRows = field.maxRows,
                        fieldKey = field.key,
                    )
                    FormFieldType.CALCULATED -> {
                        // Display computed value as read-only text
                        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                            OutlinedTextField(
                                value = value,
                                onValueChange = {},
                                label = { Text(field.label) },
                                readOnly = true,
                                enabled = false,
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            if (field.formula != null) {
                                Text(
                                    text = "Auto-calculated",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(start = 16.dp, top = 2.dp),
                                )
                            }
                        }
                    }
                    FormFieldType.SIGNATURE -> FormTextField(
                        label = field.label, value = value,
                        onValueChange = { onValueChange(field.key, it) },
                        error = error, required = field.required,
                        placeholder = field.placeholder ?: "Signature",
                    )
                }
            }
        }
    }
}

private fun evaluateConditions(
    conditions: List<FieldCondition>,
    logic: String,
    values: Map<String, String>,
): Boolean {
    if (conditions.isEmpty()) return true
    val results = conditions.map { cond ->
        val fieldValue = values[cond.field].orEmpty()
        val condResult = when (cond.operator) {
            "equals" -> fieldValue == cond.value
            "notEquals" -> fieldValue != cond.value
            "contains" -> fieldValue.contains(cond.value ?: "", ignoreCase = true)
            "isEmpty" -> fieldValue.isBlank()
            "isNotEmpty" -> fieldValue.isNotBlank()
            "greaterThan" -> (fieldValue.toDoubleOrNull() ?: 0.0) > (cond.value?.toDoubleOrNull() ?: 0.0)
            "lessThan" -> (fieldValue.toDoubleOrNull() ?: 0.0) < (cond.value?.toDoubleOrNull() ?: 0.0)
            "in" -> cond.value?.split(",")?.map { it.trim() }?.contains(fieldValue) ?: false
            "isTrue" -> fieldValue == "true"
            "isFalse" -> fieldValue != "true"
            "startsWith" -> fieldValue.startsWith(cond.value ?: "", ignoreCase = true)
            "endsWith" -> fieldValue.endsWith(cond.value ?: "", ignoreCase = true)
            else -> true
        }
        // Invert for "hide" action
        when (cond.action) {
            "hide" -> !condResult
            "show" -> condResult
            else -> condResult
        }
    }
    return if (logic == "any") results.any { it } else results.all { it }
}
