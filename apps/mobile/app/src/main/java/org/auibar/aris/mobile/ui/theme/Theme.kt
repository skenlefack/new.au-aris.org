package org.auibar.aris.mobile.ui.theme

import android.content.Context
import android.os.Build
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = ArisPrimary,
    onPrimary = ArisOnPrimary,
    primaryContainer = ArisPrimaryLight,
    secondary = ArisSecondary,
    onSecondary = ArisOnSecondary,
    secondaryContainer = ArisSecondaryLight,
    error = ArisError,
    surface = ArisSurface,
    background = ArisBackground,
    onSurface = ArisOnSurface,
)

private val DarkColorScheme = darkColorScheme(
    primary = ArisPrimaryLight,
    onPrimary = ArisPrimaryDark,
    primaryContainer = ArisPrimary,
    secondary = ArisSecondaryLight,
    onSecondary = ArisSecondaryDark,
    secondaryContainer = ArisSecondary,
    error = ArisError,
)

private val HighContrastLightColorScheme = lightColorScheme(
    primary = Color(0xFF0D3B0F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFF1B5E20),
    onPrimaryContainer = Color.White,
    secondary = Color(0xFF004D50),
    onSecondary = Color.White,
    error = Color(0xFFB71C1C),
    onError = Color.White,
    background = Color.White,
    onBackground = Color.Black,
    surface = Color.White,
    onSurface = Color.Black,
    surfaceVariant = Color(0xFFE8E8E8),
    onSurfaceVariant = Color(0xFF1A1A1A),
    outline = Color(0xFF333333),
)

private val HighContrastDarkColorScheme = darkColorScheme(
    primary = Color(0xFF81C784),
    onPrimary = Color.Black,
    primaryContainer = Color(0xFF2E7D32),
    onPrimaryContainer = Color.White,
    secondary = Color(0xFF80CBC4),
    onSecondary = Color.Black,
    error = Color(0xFFEF9A9A),
    onError = Color.Black,
    background = Color.Black,
    onBackground = Color.White,
    surface = Color(0xFF0A0A0A),
    onSurface = Color.White,
    surfaceVariant = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFFE0E0E0),
    outline = Color(0xFFCCCCCC),
)

@Composable
fun ArisTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    isHighContrast: Boolean = false,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val accessibilityManager =
        context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    val useHighContrast = isHighContrast || (accessibilityManager?.let {
        it.isEnabled && it.isTouchExplorationEnabled
    } ?: false)

    val colorScheme = when {
        useHighContrast && darkTheme -> HighContrastDarkColorScheme
        useHighContrast -> HighContrastLightColorScheme
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = ArisTypography,
        content = content,
    )
}
