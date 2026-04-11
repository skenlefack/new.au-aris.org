package org.auibar.aris.mobile.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.SetMeal
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.VolunteerActivism
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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

val arisDomains = listOf(
    DomainInfo("health",     "Animal Health",   Icons.Default.Biotech,           DomainAnimalHealth),
    DomainInfo("livestock",  "Livestock",        Icons.Default.Pets,              DomainLivestock),
    DomainInfo("fisheries",  "Fisheries",        Icons.Default.SetMeal,           DomainFisheries),
    DomainInfo("trade",      "Trade & SPS",      Icons.Default.LocalShipping,     DomainTrade),
    DomainInfo("wildlife",   "Wildlife",         Icons.Default.Park,              DomainWildlife),
    DomainInfo("apiculture", "Apiculture",       Icons.Default.VolunteerActivism, DomainApiculture),
    DomainInfo("governance", "Governance",        Icons.Default.Inventory,         DomainGovernance),
    DomainInfo("climate",    "Climate",          Icons.Default.Thermostat,        DomainClimate),
    DomainInfo("knowledge",  "Knowledge",        Icons.Default.School,            DomainKnowledge),
    DomainInfo("paid",       "PAID",             Icons.Default.Inventory,         DomainPaid),
)

/**
 * Hardcoded domain activation config.
 * Active domains are shown in the UI; disabled domains are hidden from navigation.
 * All domain screens remain intact — only their visibility is toggled here.
 */
object DomainActivation {
    /** Domain keys that are currently active and visible in the app. */
    val ACTIVE_DOMAINS: Set<String> = setOf(
        "health",
        "livestock",
        "fisheries",
        "trade",
        "governance",
        "paid",
    )

    /** Domain keys that are currently disabled and hidden from navigation. */
    val DISABLED_DOMAINS: Set<String> = setOf(
        "wildlife",
        "apiculture",
        "climate",
    )

    fun isActive(domainKey: String): Boolean = domainKey in ACTIVE_DOMAINS
}

/**
 * Returns only active domains, combining server-active codes with the local
 * [DomainActivation] config. Disabled domains are always hidden regardless
 * of server settings.
 */
fun getActiveDomains(tokenManager: TokenManager): List<DomainInfo> {
    val activeCodes = tokenManager.getActiveDomainCodes()
    val base = if (activeCodes.isEmpty()) arisDomains else arisDomains.filter { it.key in activeCodes }
    return base.filter { DomainActivation.isActive(it.key) }
}
