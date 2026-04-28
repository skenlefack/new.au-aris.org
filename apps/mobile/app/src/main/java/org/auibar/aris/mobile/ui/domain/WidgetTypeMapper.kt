package org.auibar.aris.mobile.ui.domain

/**
 * Maps backend WidgetType enum values to mobile-friendly display types.
 * Matches the web frontend mapping in dashboard-hooks.ts.
 */
object WidgetTypeMapper {
    fun backendToMobile(backendType: String): String = when (backendType.uppercase()) {
        "LINE_CHART" -> "LINE"
        "BAR_CHART" -> "BAR"
        "PIE_CHART" -> "PIE"
        "AREA_CHART" -> "AREA"
        "MAP_AFRICA" -> "MAP"
        "IFRAME_BI" -> "IFRAME"
        "HEATMAP" -> "BAR"
        "COMPOSITE_FORMULA" -> "KPI_CARD"
        // 1:1 mappings
        "KPI_CARD" -> "KPI_CARD"
        "STACKED_BAR" -> "STACKED_BAR"
        "TABLE" -> "TABLE"
        "GAUGE" -> "GAUGE"
        "TEXT_BLOCK" -> "TEXT_BLOCK"
        "ALERT_FEED" -> "ALERT_FEED"
        "PROGRESS_BAR" -> "PROGRESS_BAR"
        "STAT_CARD" -> "STAT_CARD"
        "DIVIDER" -> "DIVIDER"
        "IMAGE" -> "IMAGE"
        "LIST" -> "LIST"
        else -> backendType.uppercase()
    }
}
