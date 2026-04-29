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
)

data class SelectOption(
    val value: String,
    val label: String,
)
