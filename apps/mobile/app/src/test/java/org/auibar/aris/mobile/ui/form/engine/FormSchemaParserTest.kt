package org.auibar.aris.mobile.ui.form.engine

import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FormSchemaParserTest {

    private lateinit var parser: FormSchemaParser

    @Before
    fun setup() {
        parser = FormSchemaParser()
    }

    @Test
    fun `parse text and number fields from JSON Schema`() {
        val schema = """
        {
            "type": "object",
            "required": ["name", "count"],
            "properties": {
                "name": { "type": "string", "title": "Animal Name" },
                "count": { "type": "integer", "title": "Head Count", "minimum": 1, "maximum": 100000 }
            }
        }
        """.trimIndent()
        val uiSchema = "{}"

        val fields = parser.parse(schema, uiSchema)

        assertEquals(2, fields.size)
        val nameField = fields.find { it.key == "name" }!!
        assertEquals(FormFieldType.TEXT, nameField.type)
        assertEquals("Animal Name", nameField.label)
        assertTrue(nameField.required)

        val countField = fields.find { it.key == "count" }!!
        assertEquals(FormFieldType.NUMBER, countField.type)
        assertEquals(1.0, countField.minValue)
        assertEquals(100000.0, countField.maxValue)
    }

    @Test
    fun `parse select field from enum`() {
        val schema = """
        {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "title": "Status",
                    "enum": ["suspected", "confirmed", "resolved"],
                    "enumNames": ["Suspected", "Confirmed", "Resolved"]
                }
            }
        }
        """.trimIndent()

        val fields = parser.parse(schema, "{}")

        assertEquals(1, fields.size)
        assertEquals(FormFieldType.SELECT, fields[0].type)
        assertEquals(3, fields[0].options.size)
        assertEquals("confirmed", fields[0].options[1].value)
        assertEquals("Confirmed", fields[0].options[1].label)
    }

    @Test
    fun `parse ARIS widgets from uiSchema`() {
        val schema = """
        {
            "type": "object",
            "properties": {
                "species": { "type": "string", "title": "Species" },
                "disease": { "type": "string", "title": "Disease" },
                "location": { "type": "string", "title": "Location" },
                "photo": { "type": "string", "title": "Photo" },
                "admin": { "type": "string", "title": "Admin Zone" }
            }
        }
        """.trimIndent()
        val uiSchema = """
        {
            "species": { "ui:widget": "species-selector" },
            "disease": { "ui:widget": "disease-selector" },
            "location": { "ui:widget": "location" },
            "photo": { "ui:widget": "photo-capture" },
            "admin": { "ui:widget": "admin-cascader" }
        }
        """.trimIndent()

        val fields = parser.parse(schema, uiSchema)

        assertEquals(FormFieldType.SPECIES_SELECTOR, fields.find { it.key == "species" }!!.type)
        assertEquals(FormFieldType.DISEASE_SELECTOR, fields.find { it.key == "disease" }!!.type)
        assertEquals(FormFieldType.LOCATION, fields.find { it.key == "location" }!!.type)
        assertEquals(FormFieldType.PHOTO_CAPTURE, fields.find { it.key == "photo" }!!.type)
        assertEquals(FormFieldType.ADMIN_CASCADER, fields.find { it.key == "admin" }!!.type)
    }

    @Test
    fun `parse date field from format`() {
        val schema = """
        {
            "type": "object",
            "properties": {
                "reportDate": { "type": "string", "format": "date", "title": "Report Date" }
            }
        }
        """.trimIndent()

        val fields = parser.parse(schema, "{}")

        assertEquals(FormFieldType.DATE, fields[0].type)
    }

    @Test
    fun `ui order is respected`() {
        val schema = """
        {
            "type": "object",
            "properties": {
                "b": { "type": "string", "title": "B" },
                "a": { "type": "string", "title": "A" },
                "c": { "type": "string", "title": "C" }
            }
        }
        """.trimIndent()
        val uiSchema = """
        { "ui:order": ["c", "a", "b"] }
        """.trimIndent()

        val fields = parser.parse(schema, uiSchema)

        assertEquals("c", fields[0].key)
        assertEquals("a", fields[1].key)
        assertEquals("b", fields[2].key)
    }
}
