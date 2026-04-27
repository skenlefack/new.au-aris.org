package org.auibar.aris.mobile.ui.domain

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Agriculture
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.DirectionsBoat
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SetMeal
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.Vaccines
import androidx.compose.material.icons.filled.VolunteerActivism
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.ui.graphics.vector.ImageVector

data class DomainKpi(
    val label: String,
    val value: String,
    val subtitle: String = "",
    val trend: String = "flat", // up, down, flat
    val trendValue: String = "",
    val icon: ImageVector,
)

data class DomainQuickLink(
    val label: String,
    val icon: ImageVector,
    val action: String, // campaigns, submissions, map, reports, form
)

data class DomainDashboardConfig(
    val subtitle: String,
    val kpis: List<DomainKpi>,
    val quickLinks: List<DomainQuickLink>,
    val alertTypes: List<String> = emptyList(),
)

object DomainDashboards {

    fun configFor(domainKey: String): DomainDashboardConfig = when (domainKey) {
        "health" -> DomainDashboardConfig(
            subtitle = "Surveillance, Outbreaks, Lab & Vaccination",
            kpis = listOf(
                DomainKpi("Active Events", "24", "outbreaks tracked", "up", "+3", Icons.Default.Warning),
                DomainKpi("Countries", "38", "reporting", "up", "+2", Icons.Default.Map),
                DomainKpi("Species", "12", "under surveillance", "flat", "", Icons.Default.Biotech),
                DomainKpi("Vaccinations", "2.4M", "doses administered", "up", "+15%", Icons.Default.Vaccines),
            ),
            quickLinks = listOf(
                DomainQuickLink("Outbreak Report", Icons.Default.Warning, "outbreak_report"),
                DomainQuickLink("Surveillance", Icons.Default.Biotech, "surveillance_event"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Disease outbreak", "AMR detection", "Zoonotic event", "Lab alert"),
        )

        "livestock" -> DomainDashboardConfig(
            subtitle = "Census, Production & Pastoralism",
            kpis = listOf(
                DomainKpi("Population", "387M", "heads total", "up", "+2.1%", Icons.Default.Pets),
                DomainKpi("Countries", "42", "reporting", "up", "+5", Icons.Default.Map),
                DomainKpi("Production", "14.2M", "tonnes", "up", "+3.8%", Icons.Default.Agriculture),
                DomainKpi("Corridors", "28", "active transhumance", "flat", "", Icons.Default.LocalShipping),
            ),
            quickLinks = listOf(
                DomainQuickLink("Census Data", Icons.Default.Pets, "campaigns"),
                DomainQuickLink("Production", Icons.Default.Agriculture, "campaigns"),
                DomainQuickLink("Transhumance", Icons.Default.LocalShipping, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Census update", "Corridor alert", "Production anomaly"),
        )

        "fisheries" -> DomainDashboardConfig(
            subtitle = "Captures, Fleet, Licenses & Aquaculture",
            kpis = listOf(
                DomainKpi("Captures", "11.8M", "tonnes", "up", "+1.5%", Icons.Default.SetMeal),
                DomainKpi("Vessels", "4,320", "registered", "up", "+120", Icons.Default.DirectionsBoat),
                DomainKpi("Farms", "1,850", "aquaculture active", "up", "+8%", Icons.Default.Agriculture),
                DomainKpi("Aquaculture", "2.6M", "tonnes produced", "up", "+12%", Icons.Default.WaterDrop),
            ),
            quickLinks = listOf(
                DomainQuickLink("Capture Record", Icons.Default.SetMeal, "capture_record"),
                DomainQuickLink("Aquaculture", Icons.Default.Agriculture, "aquaculture_record"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("IUU fishing", "Stock depletion", "Aquatic disease"),
        )

        "trade" -> DomainDashboardConfig(
            subtitle = "Trade Flows, SPS Certification & Markets",
            kpis = listOf(
                DomainKpi("Exports", "\$4.2B", "USD total", "up", "+6.3%", Icons.Default.LocalShipping),
                DomainKpi("Imports", "\$3.8B", "USD total", "up", "+4.1%", Icons.Default.LocalShipping),
                DomainKpi("SPS Rate", "87%", "compliance", "up", "+2%", Icons.Default.Security),
                DomainKpi("Certificates", "12,400", "active", "up", "+800", Icons.Default.Inventory),
            ),
            quickLinks = listOf(
                DomainQuickLink("Trade Flow", Icons.Default.LocalShipping, "trade_flow"),
                DomainQuickLink("SPS Certificate", Icons.Default.Security, "sps_certificate"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("SPS non-compliance", "Border delay", "Price anomaly"),
        )

        "wildlife" -> DomainDashboardConfig(
            subtitle = "Inventories, Protected Areas & CITES",
            kpis = listOf(
                DomainKpi("Protected Areas", "1,240", "sites", "up", "+18", Icons.Default.Park),
                DomainKpi("Species", "8,450", "inventoried", "up", "+320", Icons.Default.Pets),
                DomainKpi("CITES Permits", "3,200", "issued", "flat", "", Icons.Default.Inventory),
                DomainKpi("Wildlife Crimes", "142", "reported", "down", "-12%", Icons.Default.Warning),
            ),
            quickLinks = listOf(
                DomainQuickLink("Observation", Icons.Default.Pets, "wildlife_observation"),
                DomainQuickLink("HWC Report", Icons.Default.Warning, "hwc_report"),
                DomainQuickLink("Protected Areas", Icons.Default.Park, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Poaching", "Habitat loss", "Human-wildlife conflict"),
        )

        "apiculture" -> DomainDashboardConfig(
            subtitle = "Apiaries, Production & Colony Health",
            kpis = listOf(
                DomainKpi("Apiaries", "24,500", "registered", "up", "+1,200", Icons.Default.VolunteerActivism),
                DomainKpi("Colonies", "890K", "active", "up", "+5%", Icons.Default.BugReport),
                DomainKpi("Honey", "142K", "tonnes", "up", "+8%", Icons.Default.WaterDrop),
                DomainKpi("Colony Loss", "18%", "rate", "down", "-3%", Icons.Default.HealthAndSafety),
            ),
            quickLinks = listOf(
                DomainQuickLink("Apiary Record", Icons.Default.VolunteerActivism, "apiary_record"),
                DomainQuickLink("Colony Health", Icons.Default.HealthAndSafety, "colony_health"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Colony collapse", "Pest infestation", "Pesticide exposure"),
        )

        "governance" -> DomainDashboardConfig(
            subtitle = "Legal Frameworks, Vet Evaluation & Capacities",
            kpis = listOf(
                DomainKpi("Legal Frameworks", "186", "registered", "up", "+12", Icons.Default.Gavel),
                DomainKpi("Vet Evaluations", "42", "completed", "up", "+4", Icons.Default.Assessment),
                DomainKpi("Stakeholders", "1,850", "engaged", "up", "+120", Icons.Default.Groups),
                DomainKpi("Programs", "68", "capacity building", "up", "+8", Icons.Default.School),
            ),
            quickLinks = listOf(
                DomainQuickLink("Legal Framework", Icons.Default.Gavel, "legal_framework"),
                DomainQuickLink("Vet Capacity", Icons.Default.HealthAndSafety, "vet_capacity"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Regulatory gap", "Capacity need", "Vet evaluation follow-up"),
        )

        "climate" -> DomainDashboardConfig(
            subtitle = "Water Stress, Rangelands & Vulnerability",
            kpis = listOf(
                DomainKpi("Stations", "320", "monitoring", "up", "+24", Icons.Default.Cloud),
                DomainKpi("Water Stress", "42%", "index", "up", "+3%", Icons.Default.WaterDrop),
                DomainKpi("Rangeland", "28%", "degradation", "up", "+2%", Icons.Default.Thermostat),
                DomainKpi("Hotspots", "86", "vulnerability", "up", "+8", Icons.Default.Warning),
            ),
            quickLinks = listOf(
                DomainQuickLink("Water Stress", Icons.Default.WaterDrop, "water_stress"),
                DomainQuickLink("Rangeland", Icons.Default.Thermostat, "rangeland"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Drought", "Flood", "Desertification", "Heat wave"),
        )

        "paid" -> DomainDashboardConfig(
            subtitle = "Pan-African Animal Identification & Documentation",
            kpis = listOf(
                DomainKpi("Active Campaigns", "18", "ongoing", "up", "+3", Icons.Default.Assessment),
                DomainKpi("Submissions", "4,250", "total collected", "up", "+320", Icons.Default.Inventory),
                DomainKpi("Completion", "76%", "avg rate", "up", "+5%", Icons.Default.Assessment),
                DomainKpi("Countries", "32", "participating", "up", "+4", Icons.Default.Map),
            ),
            quickLinks = listOf(
                DomainQuickLink("New Collection", Icons.Default.Assessment, "campaigns"),
                DomainQuickLink("Templates", Icons.Default.Inventory, "campaigns"),
                DomainQuickLink("Map View", Icons.Default.Map, "map"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Data gap", "Quality issue", "Deadline approaching"),
        )

        "knowledge" -> DomainDashboardConfig(
            subtitle = "Portal, E-Learning & Publications",
            kpis = listOf(
                DomainKpi("Publications", "1,240", "total", "up", "+45", Icons.AutoMirrored.Filled.MenuBook),
                DomainKpi("Courses", "86", "active", "up", "+12", Icons.Default.School),
                DomainKpi("Enrolled", "4,200", "users", "up", "+380", Icons.Default.Groups),
                DomainKpi("Completion", "72%", "avg rate", "up", "+4%", Icons.Default.Assessment),
            ),
            quickLinks = listOf(
                DomainQuickLink("Publications", Icons.AutoMirrored.Filled.MenuBook, "campaigns"),
                DomainQuickLink("E-Learning", Icons.Default.School, "campaigns"),
                DomainQuickLink("Resources", Icons.Default.Science, "campaigns"),
                DomainQuickLink("Reports", Icons.Default.Assessment, "reports"),
            ),
            alertTypes = listOf("Content request", "Resource gap"),
        )

        else -> DomainDashboardConfig(
            subtitle = "",
            kpis = emptyList(),
            quickLinks = emptyList(),
        )
    }
}
