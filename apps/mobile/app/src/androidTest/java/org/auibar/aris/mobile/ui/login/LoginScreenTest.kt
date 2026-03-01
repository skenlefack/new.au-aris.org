package org.auibar.aris.mobile.ui.login

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.junit.Rule
import org.junit.Test

class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun loginScreen_displaysAllElements() {
        composeTestRule.setContent {
            ArisTheme {
                LoginScreen(onLoginSuccess = {})
            }
        }

        // Verify branding
        composeTestRule.onNodeWithText("ARIS").assertIsDisplayed()
        composeTestRule.onNodeWithText("Animal Resources Information System").assertIsDisplayed()

        // Verify form fields
        composeTestRule.onNodeWithText("Email").assertIsDisplayed()
        composeTestRule.onNodeWithText("Password").assertIsDisplayed()

        // Verify sign in button
        composeTestRule.onNodeWithText("Sign In").assertIsDisplayed()
        composeTestRule.onNodeWithText("Sign In").assertIsEnabled()
    }

    @Test
    fun loginScreen_emailInput_acceptsText() {
        composeTestRule.setContent {
            ArisTheme {
                LoginScreen(onLoginSuccess = {})
            }
        }

        composeTestRule.onNodeWithText("Email").performTextInput("test@au-aris.org")
        composeTestRule.onNodeWithText("test@au-aris.org").assertIsDisplayed()
    }

    @Test
    fun loginScreen_passwordInput_acceptsText() {
        composeTestRule.setContent {
            ArisTheme {
                LoginScreen(onLoginSuccess = {})
            }
        }

        composeTestRule.onNodeWithText("Password").performTextInput("securePassword123")
    }

    @Test
    fun loginScreen_togglePasswordVisibility() {
        composeTestRule.setContent {
            ArisTheme {
                LoginScreen(onLoginSuccess = {})
            }
        }

        // Type password
        composeTestRule.onNodeWithText("Password").performTextInput("test123456")

        // Click show password button
        composeTestRule.onNodeWithContentDescription("Show password").performClick()

        // Verify password is visible (the text should now be visible directly)
        composeTestRule.onNodeWithText("test123456").assertIsDisplayed()

        // Click hide password button
        composeTestRule.onNodeWithContentDescription("Hide password").performClick()
    }
}
