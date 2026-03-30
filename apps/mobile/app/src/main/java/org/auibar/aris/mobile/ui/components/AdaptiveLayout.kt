package org.auibar.aris.mobile.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration

/**
 * Simple adaptive layout support for phone / tablet distinction.
 *
 * Instead of pulling in the `material3-window-size-class` dependency,
 * we derive the window type from [LocalConfiguration.current.screenWidthDp].
 *
 * Breakpoints follow Material 3 guidance:
 *  - Compact:  < 600 dp  (phones portrait)
 *  - Medium:   600–839 dp (foldables, small tablets portrait, phones landscape)
 *  - Expanded: ≥ 840 dp  (tablets landscape, desktops)
 */
enum class WindowType { COMPACT, MEDIUM, EXPANDED }

/** Composition local so any composable in the tree can read the window type. */
val LocalWindowType = compositionLocalOf { WindowType.COMPACT }

/**
 * Resolve the current window type from screen width.
 * Call this once at the Activity level and provide via [LocalWindowType].
 */
@Composable
fun rememberWindowType(): WindowType {
    val widthDp = LocalConfiguration.current.screenWidthDp
    return when {
        widthDp >= 840 -> WindowType.EXPANDED
        widthDp >= 600 -> WindowType.MEDIUM
        else -> WindowType.COMPACT
    }
}

/**
 * Helper to choose grid column count based on window type.
 * Used for domain cards, KPI cards, etc.
 */
fun gridColumns(windowType: WindowType): Int = when (windowType) {
    WindowType.COMPACT -> 2
    WindowType.MEDIUM -> 3
    WindowType.EXPANDED -> 4
}
