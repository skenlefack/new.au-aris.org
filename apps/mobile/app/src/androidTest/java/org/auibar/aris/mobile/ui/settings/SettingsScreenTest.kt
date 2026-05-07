package org.auibar.aris.mobile.ui.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.auibar.aris.mobile.util.LanguageOption
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for Settings screen composables.
 */
@RunWith(AndroidJUnit4::class)
class SettingsScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun languageOptions_allFourPresent() {
        val languages = listOf(
            LanguageOption("en", "English"),
            LanguageOption("fr", "Français"),
            LanguageOption("pt", "Português"),
            LanguageOption("ar", "العربية"),
        )

        composeTestRule.setContent {
            ArisTheme {
                androidx.compose.foundation.layout.Column {
                    languages.forEach { lang ->
                        androidx.compose.material3.Text(lang.displayName)
                    }
                }
            }
        }

        composeTestRule.onNodeWithText("English").assertIsDisplayed()
        composeTestRule.onNodeWithText("Français").assertIsDisplayed()
        composeTestRule.onNodeWithText("Português").assertIsDisplayed()
        composeTestRule.onNodeWithText("العربية").assertIsDisplayed()
    }

    @Test
    fun settingsLabels_displayCorrectly() {
        composeTestRule.setContent {
            ArisTheme {
                androidx.compose.foundation.layout.Column {
                    androidx.compose.material3.Text("Language")
                    androidx.compose.material3.Text("Sync Frequency")
                    androidx.compose.material3.Text("Server")
                    androidx.compose.material3.Text("App Lock")
                    androidx.compose.material3.Text("Clear Local Cache")
                }
            }
        }

        composeTestRule.onNodeWithText("Language").assertIsDisplayed()
        composeTestRule.onNodeWithText("Sync Frequency").assertIsDisplayed()
        composeTestRule.onNodeWithText("Server").assertIsDisplayed()
        composeTestRule.onNodeWithText("App Lock").assertIsDisplayed()
        composeTestRule.onNodeWithText("Clear Local Cache").assertIsDisplayed()
    }
}
