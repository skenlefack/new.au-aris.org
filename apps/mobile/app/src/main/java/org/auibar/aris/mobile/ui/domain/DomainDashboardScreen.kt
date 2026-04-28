package org.auibar.aris.mobile.ui.domain

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.ui.components.DomainIcon
import org.auibar.aris.mobile.ui.components.arisDomains

private val DOMAIN_COLORS = mapOf(
    "health" to Color(0xFFC62828), "livestock" to Color(0xFFE65100),
    "fisheries" to Color(0xFF0277BD), "trade" to Color(0xFF2E7D32),
    "governance" to Color(0xFF4527A0), "wildlife" to Color(0xFF795548),
    "apiculture" to Color(0xFFF9A825), "climate" to Color(0xFF00695C),
    "knowledge" to Color(0xFF1565C0), "paid" to Color(0xFF1F4E79),
)

private data class CampaignTab(val label: String, val status: String)

@Composable
fun DomainDashboardScreen(
    domainKey: String,
    onBack: () -> Unit,
    onCampaignClick: (String) -> Unit,
    onNewSubmission: () -> Unit,
    onReports: () -> Unit,
    onMap: () -> Unit,
    onDomainForm: (String) -> Unit = {},
    onFillTemplate: (String) -> Unit = {},
    onIndicators: () -> Unit = {},
    onDashboards: () -> Unit = {},
    onFlashAlerts: () -> Unit = {},
    viewModel: DomainDashboardViewModel = hiltViewModel(),
) {
    val allCampaigns by viewModel.allCampaigns.collectAsStateWithLifecycle()
    val dashboardWidgets by viewModel.dashboardWidgets.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val domainInfo = remember(domainKey) { arisDomains.find { it.key == domainKey } }
    val config = viewModel.config
    val domainColor = DOMAIN_COLORS[domainKey] ?: domainInfo?.color ?: MaterialTheme.colorScheme.primary
    val domainName = domainInfo?.label ?: domainKey.replaceFirstChar { it.uppercase() }

    // Campaign tab state
    val tabs = remember {
        listOf(
            CampaignTab("Active", "ACTIVE"),
            CampaignTab("Planned", "PLANNED"),
            CampaignTab("Completed", "COMPLETED"),
            CampaignTab("Archived", "CANCELLED"),
        )
    }
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val filteredCampaigns = remember(allCampaigns, selectedTabIndex) {
        allCampaigns.filter { it.status.equals(tabs[selectedTabIndex].status, ignoreCase = true) }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            // ═══ HEADER ═══
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(domainColor, domainColor.copy(alpha = 0.85f))))
                        .padding(top = 4.dp, bottom = 20.dp),
                ) {
                    Column {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button), tint = Color.White)
                            }
                            Spacer(Modifier.weight(1f))
                            IconButton(onClick = viewModel::refresh) {
                                Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.cd_refresh), tint = Color.White)
                            }
                        }
                        Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color.White.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                                if (domainInfo != null) DomainIcon(icon = domainInfo.icon, color = Color.White, size = 48.dp, iconSize = 24.dp, tintedBackground = false)
                                else Text(domainName.first().uppercase(), style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text(domainName, style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Bold)
                                if (config.subtitle.isNotEmpty()) Text(config.subtitle, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.8f), maxLines = 2)
                            }
                        }
                    }
                }
            }

            // ═══ SECTION 1: DASHBOARD (personalized widgets) ═══
            item {
                Spacer(Modifier.height(12.dp))
                SectionHeader(stringResource(R.string.dashboard), stringResource(R.string.dashboards), onDashboards)
            }

            if (uiState.isDashboardLoading) {
                item { DashboardSkeleton(domainColor) }
            } else if (dashboardWidgets.isEmpty()) {
                item {
                    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))) {
                        Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("No dashboard configured", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.height(8.dp))
                            Text("Browse dashboards", style = MaterialTheme.typography.labelSmall, color = domainColor, modifier = Modifier.clickable(onClick = onDashboards))
                        }
                    }
                }
            } else {
                items(dashboardWidgets, key = { it.id }) { widget ->
                    MobileWidgetRenderer(widget = widget, domainColor = domainColor, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
            }

            // ═══ SECTION 2: SUB-DOMAINS (from API, hidden if empty) ═══
            if (uiState.subDomains.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader("Sub-domains")
                }
                // 2 cards per row
                val rows = uiState.subDomains.chunked(2)
                rows.forEach { rowItems ->
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            rowItems.forEach { sub ->
                                SubDomainCard(sub = sub, domainColor = domainColor, modifier = Modifier.weight(1f))
                            }
                            // Fill empty space if odd number
                            if (rowItems.size == 1) {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            // ═══ SECTION 3: CAMPAIGNS (with status tabs) ═══
            item {
                Spacer(Modifier.height(20.dp))
                SectionHeader("Campaigns")
            }

            // Tab row
            item {
                ScrollableTabRow(
                    selectedTabIndex = selectedTabIndex,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    edgePadding = 8.dp,
                    containerColor = Color.Transparent,
                    contentColor = domainColor,
                    indicator = { tabPositions ->
                        if (selectedTabIndex < tabPositions.size) {
                            TabRowDefaults.SecondaryIndicator(
                                modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                                color = domainColor,
                                height = 3.dp,
                            )
                        }
                    },
                    divider = {},
                ) {
                    tabs.forEachIndexed { index, tab ->
                        val count = remember(allCampaigns) {
                            allCampaigns.count { it.status.equals(tab.status, ignoreCase = true) }
                        }
                        Tab(
                            selected = selectedTabIndex == index,
                            onClick = { selectedTabIndex = index },
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(tab.label, fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal)
                                    if (count > 0) {
                                        Spacer(Modifier.width(6.dp))
                                        Box(
                                            Modifier.size(20.dp).clip(CircleShape).background(
                                                if (selectedTabIndex == index) domainColor else MaterialTheme.colorScheme.surfaceVariant,
                                            ),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Text("$count", style = MaterialTheme.typography.labelSmall, color = if (selectedTabIndex == index) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }
                                }
                            },
                            selectedContentColor = domainColor,
                            unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Campaign list for selected tab
            if (uiState.isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = domainColor)
                    }
                }
            } else if (filteredCampaigns.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                        Text("No ${tabs[selectedTabIndex].label.lowercase()} campaigns", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                items(filteredCampaigns, key = { it.id }) { campaign ->
                    CampaignRow(campaign = campaign, domainColor = domainColor, onClick = { onCampaignClick(campaign.id) })
                }
            }

            // ═══ SECTION 4: FORM CATALOG ═══
            if (uiState.formTemplates.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(stringResource(R.string.form_catalog))
                }
                item {
                    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        uiState.formTemplates.forEach { template ->
                            FormTemplateRow(template = template, domainColor = domainColor, onFill = { onFillTemplate(template.id) })
                        }
                    }
                }
            }

            if (uiState.error != null) {
                item { Text(uiState.error!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp)) }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }

        // FAB
        FloatingActionButton(onClick = onNewSubmission, containerColor = domainColor, contentColor = Color.White, modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_new_submission))
        }

        // Loading overlay
        AnimatedVisibility(visible = uiState.isDashboardLoading, enter = fadeIn(), exit = fadeOut()) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = domainColor)
                    Spacer(Modifier.height(16.dp))
                    Text("Loading dashboard...", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

// ── Section Header ────────────────────────────────────────
@Composable
private fun SectionHeader(title: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (actionLabel != null && onAction != null) Text(actionLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, modifier = Modifier.clickable(onClick = onAction))
    }
}

// ── Dashboard Skeleton ────────────────────────────────────
@Composable
private fun DashboardSkeleton(domainColor: Color) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(2) { Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))) }
        }
        Box(Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)))
    }
}

// ── Sub-Domain Card (2 per row, with stats) ───────────────
@Composable
private fun SubDomainCard(sub: SubDomainUi, domainColor: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            // Title
            Text(
                text = sub.labelEn,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = domainColor,
            )

            Spacer(Modifier.height(12.dp))

            // Stats row
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatMini(value = "${sub.campaignCount}", label = "Campaigns")
                StatMini(value = "${sub.formCount}", label = "Forms")
                StatMini(value = "${sub.submissionCount}", label = "Data")
            }
        }
    }
}

@Composable
private fun StatMini(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ── Campaign Row (used in vertical list under tabs) ────────
@Composable
private fun CampaignRow(campaign: Campaign, domainColor: Color, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(campaign.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                StatusChip(status = campaign.status, domainColor = domainColor)
            }
            campaign.description?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
            }
            Spacer(Modifier.height(10.dp))
            val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)), color = domainColor, trackColor = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(Modifier.height(4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${campaign.validatedSubmissions}/${campaign.totalSubmissions} submissions", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("${String.format("%.0f", campaign.completionRate)}%", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = domainColor)
            }
        }
    }
}

// ── Status Chip ────────────────────────────────────────────
@Composable
private fun StatusChip(status: String, domainColor: Color) {
    val (bgColor, label) = when (status.uppercase()) {
        "ACTIVE" -> Color(0xFF2E7D32) to "Active"
        "PLANNED" -> Color(0xFF1565C0) to "Planned"
        "COMPLETED" -> Color(0xFF6A1B9A) to "Completed"
        "CANCELLED" -> Color(0xFF757575) to "Archived"
        else -> domainColor to status
    }
    Box(
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(bgColor.copy(alpha = 0.12f)).padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = bgColor)
    }
}

// ── Form Template Row ──────────────────────────────────────
@Composable
private fun FormTemplateRow(template: FormTemplateSummaryDto, domainColor: Color, onFill: () -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).clip(CircleShape).background(domainColor.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Description, contentDescription = null, tint = domainColor, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(template.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("v${template.version}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Card(Modifier.clickable(onClick = onFill), shape = RoundedCornerShape(8.dp), colors = CardDefaults.cardColors(containerColor = domainColor)) {
                Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Edit, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.fill), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = Color.White)
                }
            }
        }
    }
}
