package org.auibar.aris.mobile.ui.components

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.auibar.aris.mobile.util.LanguageOption
import org.auibar.aris.mobile.util.LocaleManager

/**
 * Compact language switcher button with dropdown.
 * Shows current language code (EN/FR/PT/AR) and opens a picker.
 *
 * @param localeManager The locale manager to read/write language preference
 * @param tint Icon and text color (default white for use on dark backgrounds)
 * @param bgAlpha Background opacity for the button circle
 */
@Composable
fun LanguageSwitcher(
    localeManager: LocaleManager,
    tint: Color = Color.White,
    bgAlpha: Float = 0.15f,
) {
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(false) }
    val currentLang = localeManager.currentLanguage
    val languages = localeManager.supportedLanguages

    Box {
        // Button: globe icon + language code
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(tint.copy(alpha = bgAlpha))
                .clickable { expanded = true }
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.Language,
                contentDescription = "Language",
                tint = tint.copy(alpha = 0.8f),
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(4.dp))
            Text(
                text = currentLang.uppercase(),
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                fontWeight = FontWeight.Bold,
                color = tint,
            )
        }

        // Dropdown menu
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            languages.forEach { lang ->
                DropdownMenuItem(
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = lang.code.uppercase(),
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = if (lang.code == currentLang) FontWeight.Bold else FontWeight.Normal,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(
                                        if (lang.code == currentLang)
                                            MaterialTheme.colorScheme.primaryContainer
                                        else Color.Transparent,
                                    )
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = lang.displayName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (lang.code == currentLang) FontWeight.SemiBold else FontWeight.Normal,
                            )
                        }
                    },
                    onClick = {
                        expanded = false
                        if (lang.code != currentLang) {
                            localeManager.setLanguage(lang.code)
                            // Recreate activity to apply new locale
                            (context as? Activity)?.recreate()
                        }
                    },
                )
            }
        }
    }
}
