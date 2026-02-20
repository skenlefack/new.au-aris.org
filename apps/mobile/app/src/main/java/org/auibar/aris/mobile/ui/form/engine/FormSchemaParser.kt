package org.auibar.aris.mobile.ui.form.engine

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption

class FormSchemaParser {

    private val json = Json { ignoreUnknownKeys = true }

    fun parse(schemaString: String, uiSchemaString: String): List<FormField> {
        val schema = json.parseToJsonElement(schemaString).jsonObject
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
            val fieldType = resolveFieldType(prop, widget)

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
                options = parseOptions(prop),
                placeholder = uiField?.get("ui:placeholder")?.jsonPrimitive?.content,
                description = prop["description"]?.jsonPrimitive?.content,
                order = orderList[key] ?: index,
            )
        }.sortedBy { it.order }
    }

    private fun resolveFieldType(prop: JsonObject, widget: String?): FormFieldType {
        return when (widget) {
            "species-selector" -> FormFieldType.SPECIES_SELECTOR
            "disease-selector" -> FormFieldType.DISEASE_SELECTOR
            "admin-cascader" -> FormFieldType.ADMIN_CASCADER
            "photo-capture" -> FormFieldType.PHOTO_CAPTURE
            "location" -> FormFieldType.LOCATION
            "date" -> FormFieldType.DATE
            "multi-select", "checkboxes" -> FormFieldType.MULTI_SELECT
            "select", "radio" -> FormFieldType.SELECT
            else -> {
                val type = prop["type"]?.jsonPrimitive?.content
                val format = prop["format"]?.jsonPrimitive?.content
                when {
                    format == "date" -> FormFieldType.DATE
                    type == "number" || type == "integer" -> FormFieldType.NUMBER
                    type == "array" -> FormFieldType.MULTI_SELECT
                    prop.containsKey("enum") -> FormFieldType.SELECT
                    else -> FormFieldType.TEXT
                }
            }
        }
    }

    private fun parseOptions(prop: JsonObject): List<SelectOption> {
        val enumValues = prop["enum"]?.jsonArray ?: return emptyList()
        val enumNames = prop["enumNames"]?.jsonArray

        return enumValues.mapIndexed { index, value ->
            val v = value.jsonPrimitive.content
            val label = enumNames?.getOrNull(index)?.jsonPrimitive?.content ?: v
            SelectOption(value = v, label = label)
        }
    }
}
