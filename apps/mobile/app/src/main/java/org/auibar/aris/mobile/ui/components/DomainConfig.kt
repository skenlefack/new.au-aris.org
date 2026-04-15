package org.auibar.aris.mobile.ui.components

import android.util.Log
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.SetMeal
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.VolunteerActivism
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.data.remote.dto.AppDomainDto
import org.auibar.aris.mobile.util.TokenManager
import org.auibar.aris.mobile.ui.theme.DomainAnimalHealth
import org.auibar.aris.mobile.ui.theme.DomainApiculture
import org.auibar.aris.mobile.ui.theme.DomainClimate
import org.auibar.aris.mobile.ui.theme.DomainFisheries
import org.auibar.aris.mobile.ui.theme.DomainGovernance
import org.auibar.aris.mobile.ui.theme.DomainKnowledge
import org.auibar.aris.mobile.ui.theme.DomainLivestock
import org.auibar.aris.mobile.ui.theme.DomainTrade
import org.auibar.aris.mobile.ui.theme.DomainPaid
import org.auibar.aris.mobile.ui.theme.DomainWildlife

data class DomainInfo(
    val key: String,
    val label: String,
    val icon: ImageVector,
    val color: Color,
)

// ── Lucide icon name → Material Icon mapping ────────────────────────
private val lucideToMaterial: Map<String, ImageVector> = mapOf(
    "HeartPulse" to Icons.Default.Biotech,
    "Wheat" to Icons.Default.Pets,
    "Fish" to Icons.Default.SetMeal,
    "TrendingUp" to Icons.AutoMirrored.Filled.TrendingUp,
    "TreePine" to Icons.Default.Park,
    "Bug" to Icons.Default.BugReport,
    "Cloud" to Icons.Default.Cloud,
    "BookOpen" to Icons.Default.School,
    "Building2" to Icons.Default.Inventory,
    "Flower2" to Icons.Default.VolunteerActivism,
)

// ── Backend domain code → fallback Material Icon ────────────────────
private val domainIconFallback: Map<String, ImageVector> = mapOf(
    "animal-health" to Icons.Default.Biotech,
    "livestock-prod" to Icons.Default.Pets,
    "fisheries" to Icons.Default.SetMeal,
    "trade-sps" to Icons.Default.LocalShipping,
    "wildlife" to Icons.Default.Park,
    "apiculture" to Icons.Default.VolunteerActivism,
    "governance" to Icons.Default.Inventory,
    "climate-env" to Icons.Default.Thermostat,
    "knowledge-hub" to Icons.Default.School,
    "paid" to Icons.Default.Inventory,
)

// ── Backend domain code → fallback color ────────────────────────────
private val domainColorFallback: Map<String, Color> = mapOf(
    "animal-health" to DomainAnimalHealth,
    "livestock-prod" to DomainLivestock,
    "fisheries" to DomainFisheries,
    "trade-sps" to DomainTrade,
    "wildlife" to DomainWildlife,
    "apiculture" to DomainApiculture,
    "governance" to DomainGovernance,
    "climate-env" to DomainClimate,
    "knowledge-hub" to DomainKnowledge,
    "paid" to DomainPaid,
)

/**
 * Fallback static domain list used when no server data is available
 * (first launch, offline, or before login).
 */
val arisDomains = listOf(
    DomainInfo("health", "Animal Health", Icons.Default.Biotech, DomainAnimalHealth),
    DomainInfo("livestock", "Livestock", Icons.Default.Pets, DomainLivestock),
    DomainInfo("fisheries", "Fisheries", Icons.Default.SetMeal, DomainFisheries),
    DomainInfo("trade", "Trade & SPS", Icons.Default.LocalShipping, DomainTrade),
    DomainInfo("wildlife", "Wildlife", Icons.Default.Park, DomainWildlife),
    DomainInfo("apiculture", "Apiculture", Icons.Default.VolunteerActivism, DomainApiculture),
    DomainInfo("governance", "Governance", Icons.Default.Inventory, DomainGovernance),
    DomainInfo("climate", "Climate", Icons.Default.Thermostat, DomainClimate),
    DomainInfo("knowledge", "Knowledge", Icons.Default.School, DomainKnowledge),
    DomainInfo("paid", "PAID", Icons.Default.Inventory, DomainPaid),
)

/** Parse hex color string (e.g. "#C62828") to Compose Color. */
private fun parseHexColor(hex: String): Color? {
    return try {
        val cleaned = hex.removePrefix("#")
        val colorInt = cleaned.toLong(16)
        Color(
            red = ((colorInt shr 16) and 0xFF) / 255f,
            green = ((colorInt shr 8) and 0xFF) / 255f,
            blue = (colorInt and 0xFF) / 255f,
        )
    } catch (_: Exception) {
        null
    }
}

/** Convert a server [AppDomainDto] into a UI [DomainInfo]. */
fun AppDomainDto.toDomainInfo(language: String): DomainInfo {
    val mobileKey = RoleConfig.backendToMobileKey(code)
    val label = name[language] ?: name["en"] ?: code
    val materialIcon = lucideToMaterial[icon]
        ?: domainIconFallback[code]
        ?: Icons.Default.Book
    val domainColor = parseHexColor(color)
        ?: domainColorFallback[code]
        ?: Color(0xFF1B5E20)

    return DomainInfo(
        key = mobileKey,
        label = label,
        icon = materialIcon,
        color = domainColor,
    )
}

private val jsonParser = Json { ignoreUnknownKeys = true }

/**
 * Returns active domains built from server data stored in [TokenManager].
 * Domains come with their localized names, server-defined colors and icons.
 * Falls back to the hardcoded [arisDomains] list when no server data is available.
 */
fun getActiveDomains(tokenManager: TokenManager): List<DomainInfo> {
    val json = tokenManager.activeDomainsJson
    if (!json.isNullOrBlank()) {
        try {
            val dtos = jsonParser.decodeFromString<List<AppDomainDto>>(json)
            if (dtos.isNotEmpty()) {
                val lang = tokenManager.language
                return dtos
                    .filter { it.isActive }
                    .sortedBy { it.sortOrder }
                    .map { it.toDomainInfo(lang) }
            }
        } catch (e: Exception) {
            Log.w("DomainConfig", "Failed to parse server domains, using fallback", e)
        }
    }

    // Fallback: filter hardcoded list by active domain codes
    val activeCodes = tokenManager.getActiveDomainCodes()
    return if (activeCodes.isEmpty()) arisDomains else arisDomains.filter { it.key in activeCodes }
}
