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
)

/** Returns only server-active domains, falling back to the full list if unavailable. */
fun getActiveDomains(tokenManager: TokenManager): List<DomainInfo> {
    val activeCodes = tokenManager.getActiveDomainCodes()
    if (activeCodes.isEmpty()) return arisDomains
    return arisDomains.filter { it.key in activeCodes }
}
