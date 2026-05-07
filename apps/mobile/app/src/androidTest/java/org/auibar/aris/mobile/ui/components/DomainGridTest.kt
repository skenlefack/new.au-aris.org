package org.auibar.aris.mobile.ui.components

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for the DomainGrid and DomainCard composables.
 */
@RunWith(AndroidJUnit4::class)
class DomainGridTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun domainGrid_displaysAllDomains() {
        composeTestRule.setContent {
            ArisTheme {
                DomainGrid()
            }
        }

        // Verify that at least some domains are displayed
        arisDomains.take(4).forEach { domain ->
            composeTestRule.onNodeWithText(domain.label).assertIsDisplayed()
        }
    }

    @Test
    fun domainGrid_clickCallsCallback() {
        var clickedDomain: DomainInfo? = null

        composeTestRule.setContent {
            ArisTheme {
                DomainGrid(
                    onDomainClick = { clickedDomain = it },
                )
            }
        }

        val firstDomain = arisDomains.first()
        composeTestRule.onNodeWithText(firstDomain.label).performClick()
        assertEquals(firstDomain.key, clickedDomain?.key)
    }

    @Test
    fun domainCard_hasAccessibilityLabel() {
        val domain = arisDomains.first()

        composeTestRule.setContent {
            ArisTheme {
                DomainGrid()
            }
        }

        composeTestRule.onNodeWithContentDescription(domain.label).assertIsDisplayed()
    }

    @Test
    fun arisDomains_containsNineDomains() {
        // ARIS covers 9 business domains
        assertTrue(
            "Expected at least 9 domains, got ${arisDomains.size}",
            arisDomains.size >= 9,
        )
    }

    @Test
    fun arisDomains_haveUniqueKeys() {
        val keys = arisDomains.map { it.key }
        assertEquals(
            "Duplicate domain keys found",
            keys.size,
            keys.toSet().size,
        )
    }
}
