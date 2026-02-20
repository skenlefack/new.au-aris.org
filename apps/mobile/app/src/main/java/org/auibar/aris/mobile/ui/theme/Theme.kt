package org.auibar.aris.mobile.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
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

@Composable
fun ArisTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
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
