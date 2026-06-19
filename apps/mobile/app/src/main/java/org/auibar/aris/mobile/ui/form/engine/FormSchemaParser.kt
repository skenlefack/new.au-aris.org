package org.auibar.aris.mobile.ui.form.engine

import android.util.Log
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.ui.form.model.FieldCondition
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption

private const val TAG = "FormSchemaParser"

class FormSchemaParser {

    private val json = Json { ignoreUnknownKeys = true }

    fun parse(schemaString: String, uiSchemaString: String): List<FormField> {
        return try {
            val schema = json.parseToJsonElement(schemaString).jsonObject

            // Detect format: new sections-based or old JSON Schema
            if (schema.containsKey("sections")) {
                parseSectionsFormat(schema)
            } else if (schema.containsKey("properties")) {
                parseJsonSchemaFormat(schema, uiSchemaString)
            } else {
                Log.w(TAG, "Unknown schema format, keys: ${schema.keys}")
                emptyList()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Schema parse error: ${e.message}")
            emptyList()
        }
    }

    // ── New section-based format ─────────────────────────────
    // {"sections":[{"id":"...","name":{"en":"..."},"fields":[{"id":"...","code":"...","type":"text","label":{"en":"..."},...}]}]}
    private fun parseSectionsFormat(schema: JsonObject): List<FormField> {
        val sections = schema["sections"]?.jsonArray ?: return emptyList()
        val fields = mutableListOf<FormField>()
        var globalOrder = 0

        for (section in sections) {
            val sec = section.jsonObject
            val sectionFields = sec["fields"]?.jsonArray ?: continue
            val sectionName = extractLocalizedString(sec["name"]?.jsonObject, null)
            val sectionDescription = extractLocalizedString(sec["description"]?.jsonObject, null)
                .ifBlank { null }

            for (field in sectionFields) {
                val f = field.jsonObject
                val code = f["code"]?.jsonPrimitive?.content ?: continue
                val type = f["type"]?.jsonPrimitive?.content ?: "text"
                val required = f["required"]?.jsonPrimitive?.booleanOrNull ?: false
                val order = f["order"]?.jsonPrimitive?.intOrNull ?: globalOrder

                // Multilingual label — prefer EN, fallback FR
                val label = extractLocalizedString(f["label"]?.jsonObject, code)
                val helpText = extractLocalizedString(f["helpText"]?.jsonObject, null)
                val placeholder = extractLocalizedString(f["placeholder"]?.jsonObject, null)

                // Options for select fields
                val options = parseFieldOptions(f)

                val props = f["properties"]?.jsonObject
                val validation = f["validation"]?.jsonObject
                val masterDataType = props?.get("masterDataType")?.jsonPrimitive?.content
                val searchable = props?.get("searchable")?.jsonPrimitive?.booleanOrNull ?: false
                val disableFuture = validation?.get("disableFuture")?.jsonPrimitive?.booleanOrNull ?: false
                val step = props?.get("step")?.jsonPrimitive?.content?.toDoubleOrNull()
                val decimals = props?.get("decimals")?.jsonPrimitive?.intOrNull
                val maxLength = validation?.get("maxLength")?.jsonPrimitive?.intOrNull
                val min = validation?.get("min")?.jsonPrimitive?.content?.toDoubleOrNull()
                val max = validation?.get("max")?.jsonPrimitive?.content?.toDoubleOrNull()

                val fieldType = mapSectionFieldType(type, f)

                // Parse conditions
                val conditions = parseConditions(f)
                val conditionLogic = props?.get("conditionLogic")?.jsonPrimitive?.content
                    ?: f["conditionLogic"]?.jsonPrimitive?.content
                    ?: "all"

                // Default value
                val defaultValue = props?.get("defaultValue")?.jsonPrimitive?.content
                    ?: f["defaultValue"]?.jsonPrimitive?.content

                // Read-only / hidden
                val readOnly = props?.get("readOnly")?.jsonPrimitive?.booleanOrNull ?: false
                val hidden = props?.get("hidden")?.jsonPrimitive?.booleanOrNull ?: false

                // Date constraints
                val minDate = validation?.get("minDate")?.jsonPrimitive?.content
                val maxDate = validation?.get("maxDate")?.jsonPrimitive?.content
                val disablePast = validation?.get("disablePast")?.jsonPrimitive?.booleanOrNull ?: false

                // Textarea properties
                val multiline = fieldType == FormFieldType.TEXTAREA
                val rows = props?.get("rows")?.jsonPrimitive?.intOrNull ?: 3

                // Geo mode
                val geoMode = props?.get("geoMode")?.jsonPrimitive?.content ?: "point"

                // Repeater fields
                val repeaterFields = if (fieldType == FormFieldType.REPEATER) {
                    parseRepeaterFields(f)
                } else emptyList()
                val minRows = props?.get("minRows")?.jsonPrimitive?.intOrNull ?: 0
                val maxRows = props?.get("maxRows")?.jsonPrimitive?.intOrNull ?: 10

                // Calculated formula
                val formula = props?.get("formula")?.jsonPrimitive?.content

                // Custom validation message
                val customValidationMessage = validation?.get("customMessage")?.let { el ->
                    try {
                        extractLocalizedString(el.jsonObject, null).ifBlank { null }
                    } catch (_: Exception) {
                        try { el.jsonPrimitive.content } catch (_: Exception) { null }
                    }
                }

                fields.add(
                    FormField(
                        key = code,
                        label = label,
                        type = fieldType,
                        required = required,
                        options = options,
                        placeholder = placeholder,
                        description = helpText,
                        order = order,
                        masterDataType = masterDataType,
                        searchable = searchable,
                        disableFuture = disableFuture,
                        step = step,
                        decimals = decimals,
                        maxLength = maxLength,
                        minValue = min,
                        maxValue = max,
                        sectionName = sectionName,
                        conditions = conditions,
                        conditionLogic = conditionLogic,
                        defaultValue = defaultValue,
                        readOnly = readOnly,
                        hidden = hidden,
                        minDate = minDate,
                        maxDate = maxDate,
                        disablePast = disablePast,
                        multiline = multiline,
                        rows = rows,
                        geoMode = geoMode,
                        repeaterFields = repeaterFields,
                        minRows = minRows,
                        maxRows = maxRows,
                        formula = formula,
                        customValidationMessage = customValidationMessage,
                        sectionDescription = sectionDescription,
                    )
                )
                globalOrder++
            }
        }

        Log.d(TAG, "Parsed ${fields.size} fields from sections format")
        return fields.sortedBy { it.order }
    }

    private fun extractLocalizedString(obj: JsonObject?, fallback: String?): String {
        if (obj == null) return fallback ?: ""
        return obj["en"]?.jsonPrimitive?.content
            ?: obj["fr"]?.jsonPrimitive?.content
            ?: obj.values.firstOrNull()?.jsonPrimitive?.content
            ?: fallback ?: ""
    }

    private fun mapSectionFieldType(type: String, field: JsonObject): FormFieldType {
        return when (type.lowercase()) {
            "text", "string" -> FormFieldType.TEXT
            "textarea" -> FormFieldType.TEXTAREA
            "number", "integer", "decimal" -> FormFieldType.NUMBER
            "date", "datetime" -> FormFieldType.DATE
            "time" -> FormFieldType.TIME
            "select", "dropdown" -> FormFieldType.SELECT
            "multi-select", "multiselect", "checkboxes", "checkbox-group" -> FormFieldType.MULTI_SELECT
            "radio" -> FormFieldType.RADIO
            "toggle", "switch", "boolean" -> FormFieldType.TOGGLE
            "master-data-select" -> {
                val masterType = field["properties"]?.jsonObject?.get("masterDataType")?.jsonPrimitive?.content
                when (masterType) {
                    "species", "breeds" -> FormFieldType.SPECIES_SELECTOR
                    "diseases" -> FormFieldType.DISEASE_SELECTOR
                    else -> FormFieldType.SELECT
                }
            }
            "admin-location" -> FormFieldType.ADMIN_CASCADER
            "location", "gps" -> FormFieldType.LOCATION
            "geo-point" -> FormFieldType.LOCATION
            "geo-polygon", "geo-selector", "geo" -> FormFieldType.GEO_SELECTOR
            "photo", "image", "camera" -> FormFieldType.PHOTO_CAPTURE
            "file-upload", "file" -> FormFieldType.FILE_UPLOAD
            "heading", "title" -> FormFieldType.HEADING
            "info-box", "info", "callout" -> FormFieldType.INFO_BOX
            "divider", "separator" -> FormFieldType.DIVIDER
            "repeater" -> FormFieldType.REPEATER
            "calculated", "computed" -> FormFieldType.CALCULATED
            "signature" -> FormFieldType.SIGNATURE
            else -> FormFieldType.TEXT
        }
    }

    private fun parseConditions(field: JsonObject): List<FieldCondition> {
        val conditionsArray = field["conditions"]?.jsonArray ?: return emptyList()
        return conditionsArray.mapNotNull { el ->
            try {
                val cond = el.jsonObject
                val fieldKey = cond["field"]?.jsonPrimitive?.content ?: return@mapNotNull null
                val operator = cond["operator"]?.jsonPrimitive?.content ?: "equals"
                val value = cond["value"]?.jsonPrimitive?.content
                val action = cond["action"]?.jsonPrimitive?.content ?: "show"
                FieldCondition(field = fieldKey, operator = operator, value = value, action = action)
            } catch (_: Exception) { null }
        }
    }

    private fun parseRepeaterFields(field: JsonObject): List<FormField> {
        val fieldsArray = field["fields"]?.jsonArray
            ?: field["properties"]?.jsonObject?.get("fields")?.jsonArray
            ?: return emptyList()
        return fieldsArray.mapNotNull { el ->
            try {
                val f = el.jsonObject
                val code = f["code"]?.jsonPrimitive?.content ?: return@mapNotNull null
                val type = f["type"]?.jsonPrimitive?.content ?: "text"
                val label = extractLocalizedString(f["label"]?.jsonObject, code)
                val required = f["required"]?.jsonPrimitive?.booleanOrNull ?: false
                val options = parseFieldOptions(f)
                val fieldType = mapSectionFieldType(type, f)
                FormField(
                    key = code,
                    label = label,
                    type = fieldType,
                    required = required,
                    options = options,
                )
            } catch (_: Exception) { null }
        }
    }

    private fun parseFieldOptions(field: JsonObject): List<SelectOption> {
        // Check properties.options array
        val props = field["properties"]?.jsonObject
        val options = props?.get("options")?.jsonArray ?: field["options"]?.jsonArray ?: return emptyList()
        return options.mapNotNull { opt ->
            try {
                val o = opt.jsonObject
                val value = o["value"]?.jsonPrimitive?.content ?: return@mapNotNull null
                val label = extractLocalizedString(o["label"]?.jsonObject, value)
                SelectOption(value = value, label = label)
            } catch (_: Exception) {
                // Simple string options
                try {
                    SelectOption(value = opt.jsonPrimitive.content, label = opt.jsonPrimitive.content)
                } catch (_: Exception) { null }
            }
        }
    }

    // ── Old JSON Schema format (backward compat) ────────────
    // {"properties":{"field1":{"type":"string","title":"..."},...},"required":["field1",...]}
    private fun parseJsonSchemaFormat(schema: JsonObject, uiSchemaString: String): List<FormField> {
        val uiSchema = try {
            json.parseToJsonElement(uiSchemaString).jsonObject
        } catch (_: Exception) {
            JsonObject(emptyMap())
        }

        val properties = schema["properties"]?.jsonObject ?: return emptyList()
        val requiredFields = schema["required"]?.jsonArray
            ?.map { it.jsonPrimitive.content }
            ?.toSet() ?: emptySet()

        val orderList = uiSchema["ui:order"]?.jsonArray
            ?.mapIndexed { index, el -> el.jsonPrimitive.content to index }
            ?.toMap() ?: emptyMap()

        return properties.entries.mapIndexed { index, (key, value) ->
            val prop = value.jsonObject
            val uiField = uiSchema[key]?.jsonObject
            val widget = uiField?.get("ui:widget")?.jsonPrimitive?.content
            val fieldType = resolveFieldTypeLegacy(prop, widget)

            FormField(
                key = key,
                label = prop["title"]?.jsonPrimitive?.content ?: key,
                type = fieldType,
                required = key in requiredFields,
                pattern = prop["pattern"]?.jsonPrimitive?.content,
                minValue = prop["minimum"]?.jsonPrimitive?.double,
                maxValue = prop["maximum"]?.jsonPrimitive?.double,
                minLength = prop["minLength"]?.jsonPrimitive?.int,
                maxLength = prop["maxLength"]?.jsonPrimitive?.int,
                options = parseOptionsLegacy(prop),
                placeholder = uiField?.get("ui:placeholder")?.jsonPrimitive?.content,
                description = prop["description"]?.jsonPrimitive?.content,
                order = orderList[key] ?: index,
            )
        }.sortedBy { it.order }
    }

    private fun resolveFieldTypeLegacy(prop: JsonObject, widget: String?): FormFieldType {
        return when (widget) {
            "species-selector" -> FormFieldType.SPECIES_SELECTOR
            "disease-selector" -> FormFieldType.DISEASE_SELECTOR
            "admin-cascader" -> FormFieldType.ADMIN_CASCADER
            "photo-capture" -> FormFieldType.PHOTO_CAPTURE
            "location" -> FormFieldType.LOCATION
            "date" -> FormFieldType.DATE
            "multi-select", "checkboxes" -> FormFieldType.MULTI_SELECT
            "select", "radio" -> FormFieldType.SELECT
            "textarea" -> FormFieldType.TEXTAREA
            "toggle", "switch" -> FormFieldType.TOGGLE
            "geo-selector" -> FormFieldType.GEO_SELECTOR
            "signature" -> FormFieldType.SIGNATURE
            else -> {
                val type = prop["type"]?.jsonPrimitive?.content
                val format = prop["format"]?.jsonPrimitive?.content
                when {
                    format == "date" -> FormFieldType.DATE
                    format == "time" -> FormFieldType.TIME
                    type == "number" || type == "integer" -> FormFieldType.NUMBER
                    type == "boolean" -> FormFieldType.TOGGLE
                    type == "array" -> FormFieldType.MULTI_SELECT
                    prop.containsKey("enum") -> FormFieldType.SELECT
                    else -> FormFieldType.TEXT
                }
            }
        }
    }

    private fun parseOptionsLegacy(prop: JsonObject): List<SelectOption> {
        val enumValues = prop["enum"]?.jsonArray ?: return emptyList()
        val enumNames = prop["enumNames"]?.jsonArray
        return enumValues.mapIndexed { index, value ->
            val v = value.jsonPrimitive.content
            val label = enumNames?.getOrNull(index)?.jsonPrimitive?.content ?: v
            SelectOption(value = v, label = label)
        }
    }
}
