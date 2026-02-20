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
)

data class SelectOption(
    val value: String,
    val label: String,
)
