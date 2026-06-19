package org.auibar.aris.mobile.ui.form.model

data class FormField(
    val key: String,
    val label: String,
    val type: FormFieldType,
    val required: Boolean = false,
    val pattern: String? = null,
    val minValue: Double? = null,
    val maxValue: Double? = null,
    val minLength: Int? = null,
    val maxLength: Int? = null,
    val options: List<SelectOption> = emptyList(),
    val placeholder: String? = null,
    val description: String? = null,
    val order: Int = 0,
    /** For master-data-select fields: type key (species, diseases, breeds, ...) */
    val masterDataType: String? = null,
    /** Whether this field supports search/filtering */
    val searchable: Boolean = false,
    /** Validation rules from schema */
    val disableFuture: Boolean = false,
    val step: Double? = null,
    val decimals: Int? = null,
    /** Section name this field belongs to */
    val sectionName: String? = null,

    // Conditional visibility
    val conditions: List<FieldCondition> = emptyList(),
    val conditionLogic: String = "all", // "all" (AND) or "any" (OR)

    // Default value
    val defaultValue: String? = null,

    // Read-only / hidden
    val readOnly: Boolean = false,
    val hidden: Boolean = false,

    // Date constraints
    val minDate: String? = null,
    val maxDate: String? = null,
    val disablePast: Boolean = false,

    // Textarea
    val multiline: Boolean = false,
    val rows: Int = 3,

    // Geo mode
    val geoMode: String = "point", // "point", "polyline", "polygon", "selector"

    // Repeater
    val repeaterFields: List<FormField> = emptyList(),
    val minRows: Int = 0,
    val maxRows: Int = 10,

    // Calculated field formula
    val formula: String? = null,

    // Custom validation message (i18n)
    val customValidationMessage: String? = null,

    // Section description
    val sectionDescription: String? = null,
)

data class SelectOption(
    val value: String,
    val label: String,
)

data class FieldCondition(
    val field: String,
    val operator: String, // equals, notEquals, contains, isEmpty, isNotEmpty, greaterThan, lessThan, in, isTrue, isFalse
    val value: String? = null,
    val action: String = "show", // show, hide, enable, disable, setRequired
)
