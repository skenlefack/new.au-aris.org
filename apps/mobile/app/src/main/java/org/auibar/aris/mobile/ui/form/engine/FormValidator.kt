package org.auibar.aris.mobile.ui.form.engine

import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.ValidationError

class FormValidator {

    /**
     * @param adminVisibleLevels levels actually shown for an admin-location field
     *   (form levels restricted to the selected country's configuration).
     */
    fun validate(
        fields: List<FormField>,
        values: Map<String, String>,
        adminVisibleLevels: (FormField) -> List<Int> = { it.adminLevels },
    ): List<ValidationError> {
        val errors = mutableListOf<ValidationError>()

        for (field in fields) {
            if (field.type == FormFieldType.ADMIN_CASCADER) {
                errors.addAll(validateAdminLocation(field, values, adminVisibleLevels(field)))
                continue
            }
            val value = values[field.key]?.trim().orEmpty()
            val fieldErrors = validateField(field, value)
            errors.addAll(fieldErrors)
        }

        return errors
    }

    /**
     * Only a required field is enforced (like the web renderer): the country, plus every level
     * listed in requiredLevels that is shown for the selected country.
     */
    fun validateAdminLocation(
        field: FormField,
        values: Map<String, String>,
        visibleLevels: List<Int>,
    ): List<ValidationError> {
        if (!field.required) return emptyList()
        val filled = { level: Int -> !values[AdminLocation.key(field.key, level)].isNullOrBlank() }
        val required = (field.adminRequiredLevels.filter { it in visibleLevels } + 0).toSortedSet()
        val missing = required.firstOrNull { !filled(it) } ?: return emptyList()
        return listOf(ValidationError(field.key, "${field.label} is required (level $missing)"))
    }

    fun validateField(field: FormField, value: String): List<ValidationError> {
        val errors = mutableListOf<ValidationError>()

        if (field.required && value.isBlank()) {
            errors.add(ValidationError(field.key, "${field.label} is required"))
            return errors
        }

        if (value.isBlank()) return errors

        field.minLength?.let { min ->
            if (value.length < min) {
                errors.add(ValidationError(field.key, "${field.label} must be at least $min characters"))
            }
        }

        field.maxLength?.let { max ->
            if (value.length > max) {
                errors.add(ValidationError(field.key, "${field.label} must be at most $max characters"))
            }
        }

        field.pattern?.let { pattern ->
            if (!Regex(pattern).matches(value)) {
                errors.add(ValidationError(field.key, "${field.label} has an invalid format"))
            }
        }

        if (field.type == FormFieldType.NUMBER) {
            val number = value.toDoubleOrNull()
            if (number == null) {
                errors.add(ValidationError(field.key, "${field.label} must be a number"))
            } else {
                field.minValue?.let { min ->
                    if (number < min) {
                        errors.add(ValidationError(field.key, "${field.label} must be at least $min"))
                    }
                }
                field.maxValue?.let { max ->
                    if (number > max) {
                        errors.add(ValidationError(field.key, "${field.label} must be at most $max"))
                    }
                }
            }
        }

        if (field.type == FormFieldType.SELECT && field.options.isNotEmpty()) {
            if (field.options.none { it.value == value }) {
                errors.add(ValidationError(field.key, "${field.label} has an invalid selection"))
            }
        }

        return errors
    }
}
