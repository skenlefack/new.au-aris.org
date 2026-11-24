package org.auibar.aris.mobile.ui.form.engine

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** One administrative level configured for a country in Settings > Countries (web). */
data class AdminLevelConfig(
    val level: Int,
    val names: Map<String, String>,
    val isActive: Boolean = true,
) {
    fun label(language: String): String? =
        (names[language] ?: names["en"] ?: names["fr"] ?: names.values.firstOrNull())
            ?.takeIf { it.isNotBlank() }
}

/** What the admin-location field shows for the selected country. */
data class AdminFieldView(
    val levels: List<Int>,
    val labels: Map<Int, String>,
)

/**
 * Admin-location values use the same shape as the web form renderer:
 * `{ "level_0": "BI", "level_1": "<uuid>", ... }`, level 0 being the ISO country code.
 * In the flat form state each level is stored under `"<fieldKey>.level_<n>"`.
 */
object AdminLocation {

    fun key(fieldKey: String, level: Int) = "$fieldKey.level_$level"

    /** Parse `"<fieldKey>.level_<n>"`, returns (fieldKey, n) or null. */
    fun parseKey(key: String): Pair<String, Int>? {
        val idx = key.lastIndexOf(".level_")
        if (idx <= 0) return null
        val level = key.substring(idx + 7).toIntOrNull() ?: return null
        return key.substring(0, idx) to level
    }

    /**
     * Restrict the form's levels to the active levels configured for the country (same rule as web):
     * country (0) always kept; no configuration (null = unknown/offline, or empty) keeps the form's levels.
     */
    fun visibleLevels(formLevels: List<Int>, configured: List<AdminLevelConfig>?): List<Int> {
        if (configured.isNullOrEmpty()) return formLevels
        val active = configured.filter { it.isActive }.map { it.level }.toSet()
        return formLevels.filter { it == 0 || it in active }
    }

    /** Nested JSON value for one admin-location field, or null when nothing was selected. */
    fun toJson(fieldKey: String, values: Map<String, String>, levels: List<Int>): JsonObject? {
        val entries = levels.sorted().mapNotNull { level ->
            values[key(fieldKey, level)]?.takeIf { it.isNotBlank() }?.let { "level_$level" to JsonPrimitive(it) }
        }
        return if (entries.isEmpty()) null else JsonObject(entries.toMap())
    }
}
