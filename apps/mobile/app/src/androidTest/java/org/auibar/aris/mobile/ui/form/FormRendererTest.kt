package org.auibar.aris.mobile.ui.form

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.junit.Rule
import org.junit.Test

class FormRendererTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val testFields = listOf(
        FormField(
            key = "name",
            type = FormFieldType.TEXT,
            label = "Farm Name",
            required = true,
        ),
        FormField(
            key = "count",
            type = FormFieldType.NUMBER,
            label = "Head Count",
            required = true,
        ),
        FormField(
            key = "date",
            type = FormFieldType.DATE,
            label = "Visit Date",
            required = false,
        ),
        FormField(
            key = "method",
            type = FormFieldType.SELECT,
            label = "Methodology",
            required = true,
            options = listOf(
                SelectOption(value = "survey", label = "Survey"),
                SelectOption(value = "aerial", label = "Aerial"),
                SelectOption(value = "ground_count", label = "Ground Count"),
            ),
        ),
    )

    @Test
    fun formRenderer_displaysAllFieldLabels() {
        composeTestRule.setContent {
            ArisTheme {
                FormRenderer(
                    fields = testFields,
                    values = emptyMap(),
                    errors = emptyMap(),
                    speciesOptions = emptyList(),
                    diseaseOptions = emptyList(),
                    countryOptions = emptyList(),
                    admin1Options = emptyList(),
                    admin2Options = emptyList(),
                    onValueChange = { _, _ -> },
                    onCaptureLocation = {},
                    onTakePhoto = {},
                )
            }
        }

        // Required fields render with " *" suffix in label
        composeTestRule.onNodeWithText("Farm Name *").assertIsDisplayed()
        composeTestRule.onNodeWithText("Head Count *").assertIsDisplayed()
        composeTestRule.onNodeWithText("Visit Date").assertIsDisplayed()
        composeTestRule.onNodeWithText("Methodology *").assertIsDisplayed()
    }

    @Test
    fun formRenderer_displaysTextFieldValues() {
        val values = mapOf("name" to "Nairobi Farm Alpha")

        composeTestRule.setContent {
            ArisTheme {
                FormRenderer(
                    fields = testFields,
                    values = values,
                    errors = emptyMap(),
                    speciesOptions = emptyList(),
                    diseaseOptions = emptyList(),
                    countryOptions = emptyList(),
                    admin1Options = emptyList(),
                    admin2Options = emptyList(),
                    onValueChange = { _, _ -> },
                    onCaptureLocation = {},
                    onTakePhoto = {},
                )
            }
        }

        composeTestRule.onNodeWithText("Nairobi Farm Alpha").assertIsDisplayed()
    }

    @Test
    fun formRenderer_displaysValidationErrors() {
        val errors = mapOf(
            "name" to "This field is required",
            "count" to "Must be a positive number",
        )

        composeTestRule.setContent {
            ArisTheme {
                FormRenderer(
                    fields = testFields,
                    values = emptyMap(),
                    errors = errors,
                    speciesOptions = emptyList(),
                    diseaseOptions = emptyList(),
                    countryOptions = emptyList(),
                    admin1Options = emptyList(),
                    admin2Options = emptyList(),
                    onValueChange = { _, _ -> },
                    onCaptureLocation = {},
                    onTakePhoto = {},
                )
            }
        }

        composeTestRule.onNodeWithText("This field is required").assertIsDisplayed()
        composeTestRule.onNodeWithText("Must be a positive number").assertIsDisplayed()
    }

    @Test
    fun formRenderer_handlesEmptyFieldList() {
        composeTestRule.setContent {
            ArisTheme {
                FormRenderer(
                    fields = emptyList(),
                    values = emptyMap(),
                    errors = emptyMap(),
                    speciesOptions = emptyList(),
                    diseaseOptions = emptyList(),
                    countryOptions = emptyList(),
                    admin1Options = emptyList(),
                    admin2Options = emptyList(),
                    onValueChange = { _, _ -> },
                    onCaptureLocation = {},
                    onTakePhoto = {},
                )
            }
        }
        // Should render without crashing
    }
}
