package org.auibar.aris.mobile.ui.form.engine

import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FormValidatorTest {

    private lateinit var validator: FormValidator

    @Before
    fun setup() {
        validator = FormValidator()
    }

    @Test
    fun `required field returns error when empty`() {
        val field = FormField(key = "name", label = "Name", type = FormFieldType.TEXT, required = true)
        val errors = validator.validateField(field, "")

        assertEquals(1, errors.size)
        assertEquals("name", errors[0].field)
        assertTrue(errors[0].message.contains("required"))
    }

    @Test
    fun `optional field passes when empty`() {
        val field = FormField(key = "note", label = "Note", type = FormFieldType.TEXT)
        val errors = validator.validateField(field, "")

        assertTrue(errors.isEmpty())
    }

    @Test
    fun `number field validates min and max`() {
        val field = FormField(
            key = "count",
            label = "Count",
            type = FormFieldType.NUMBER,
            minValue = 1.0,
            maxValue = 100.0,
        )

        assertTrue(validator.validateField(field, "50").isEmpty())
        assertEquals(1, validator.validateField(field, "0").size)
        assertEquals(1, validator.validateField(field, "101").size)
        assertEquals(1, validator.validateField(field, "abc").size)
    }

    @Test
    fun `pattern validation works`() {
        val field = FormField(
            key = "code",
            label = "Code",
            type = FormFieldType.TEXT,
            required = true,
            pattern = "^[A-Z]{2}-\\d{3}$",
        )

        assertTrue(validator.validateField(field, "KE-001").isEmpty())
        assertEquals(1, validator.validateField(field, "ke-001").size)
        assertEquals(1, validator.validateField(field, "ABCDE").size)
    }

    @Test
    fun `minLength and maxLength validation`() {
        val field = FormField(
            key = "desc",
            label = "Description",
            type = FormFieldType.TEXT,
            minLength = 5,
            maxLength = 20,
        )

        assertTrue(validator.validateField(field, "Hello World").isEmpty())
        assertEquals(1, validator.validateField(field, "Hi").size)
        assertEquals(1, validator.validateField(field, "A".repeat(21)).size)
    }

    @Test
    fun `select field validates against options`() {
        val field = FormField(
            key = "status",
            label = "Status",
            type = FormFieldType.SELECT,
            options = listOf(
                SelectOption("active", "Active"),
                SelectOption("closed", "Closed"),
            ),
        )

        assertTrue(validator.validateField(field, "active").isEmpty())
        assertEquals(1, validator.validateField(field, "invalid").size)
    }

    @Test
    fun `validate multiple fields at once`() {
        val fields = listOf(
            FormField(key = "name", label = "Name", type = FormFieldType.TEXT, required = true),
            FormField(key = "count", label = "Count", type = FormFieldType.NUMBER, required = true),
        )
        val values = mapOf("name" to "", "count" to "")

        val errors = validator.validate(fields, values)

        assertEquals(2, errors.size)
    }
}
