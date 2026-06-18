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
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Upload
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
import org.auibar.aris.mobile.data.remote.api.DomainActivityEntry
import org.auibar.aris.mobile.data.remote.api.MonthlyTrendEntry
import org.auibar.aris.mobile.data.remote.api.SubDomainBreakdownEntry
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.ui.charts.HorizontalBarChart
import org.auibar.aris.mobile.ui.charts.BarChartItem
import org.auibar.aris.mobile.ui.charts.LineChart
import org.auibar.aris.mobile.ui.charts.LineChartPoint
import org.auibar.aris.mobile.ui.charts.PieChart
import org.auibar.aris.mobile.ui.charts.PieChartSlice
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
    onReports: () -> Unit = {},
    onMap: () -> Unit = {},
    onDomainForm: (String) -> Unit = {},
    onFillTemplate: (String) -> Unit = {},
    onIndicators: () -> Unit = {},
    onDashboards: () -> Unit = {},
    onFlashAlerts: () -> Unit = {},
    onSubDomainClick: (domainKey: String, subDomainCode: String, subDomainLabel: String) -> Unit = { _, _, _ -> },
    viewModel: DomainDashboardViewModel = hiltViewModel(),
) {
    val allCampaigns by viewModel.allCampaigns.collectAsStateWithLifecycle()
    val dashboardWidgets by viewModel.dashboardWidgets.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val domainInfo = remember(domainKey) { arisDomains.find { it.key == domainKey } }
    val config = viewModel.config
    val domainColor = DOMAIN_COLORS[domainKey] ?: domainInfo?.color ?: MaterialTheme.colorScheme.primary

    // Resolve display name: sub-domain label if in sub-domain mode, else domain label
    val isSubDomain = viewModel.subDomainCode != null
    val headerName = if (isSubDomain) {
        viewModel.subDomainLabel ?: viewModel.subDomainCode ?: domainKey
    } else {
        domainInfo?.label ?: domainKey.replaceFirstChar { it.uppercase() }
    }
    val headerSubtitle = if (isSubDomain) {
        domainInfo?.label ?: domainKey
    } else {
        config.subtitle
    }

    val tabActiveLabel = stringResource(R.string.tab_active)
    val tabPlannedLabel = stringResource(R.string.tab_planned)
    val tabCompletedLabel = stringResource(R.string.tab_completed)
    val tabArchivedLabel = stringResource(R.string.tab_archived)
    val tabs = remember(tabActiveLabel, tabPlannedLabel, tabCompletedLabel, tabArchivedLabel) {
        listOf(
            CampaignTab(tabActiveLabel, "ACTIVE"),
            CampaignTab(tabPlannedLabel, "PLANNED"),
            CampaignTab(tabCompletedLabel, "COMPLETED"),
            CampaignTab(tabArchivedLabel, "CANCELLED"),
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
                                else Text(headerName.first().uppercase(), style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text(headerName, style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Bold)
                                if (headerSubtitle.isNotEmpty()) Text(headerSubtitle, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.8f), maxLines = 2)
                            }
                        }
                    }
                }
            }

            // ═══ SECTION 1: KPI BAR (from domain summary API) ═══
            if (uiState.hasSummary && uiState.summaryKpis != null) {
                item {
                    Spacer(Modifier.height(12.dp))
                    KpiBar(kpis = uiState.summaryKpis!!, domainColor = domainColor)
                }
            }

            // ═══ SECTION 2: VISUAL SYNTHESIS ═══
            if (uiState.hasSummary && (uiState.monthlyTrend.isNotEmpty() || uiState.subDomainBreakdown.isNotEmpty())) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(stringResource(R.string.domain_synthesis))
                }
                // Monthly trend chart
                if (uiState.monthlyTrend.isNotEmpty()) {
                    item { MonthlyTrendCard(trend = uiState.monthlyTrend, domainColor = domainColor) }
                }
                // Sub-domain breakdown
                if (uiState.subDomainBreakdown.isNotEmpty()) {
                    item { SubDomainBreakdownCard(breakdown = uiState.subDomainBreakdown, domainColor = domainColor) }
                }
                // Country distribution
                if (uiState.countryDistribution.isNotEmpty()) {
                    item { CountryCoverageCard(countries = uiState.countryDistribution, domainColor = domainColor) }
                }
            }

            // ═══ SECTION 3: DASHBOARD WIDGETS ═══
            if (dashboardWidgets.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(stringResource(R.string.dashboard), stringResource(R.string.dashboards), onDashboards)
                }
                items(dashboardWidgets, key = { it.id }) { widget ->
                    MobileWidgetRenderer(widget = widget, domainColor = domainColor, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
            }

            // ═══ SECTION 2: SUB-DOMAINS (only on domain level, not sub-domain level) ═══
            if (!isSubDomain && uiState.subDomains.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(stringResource(R.string.sub_domains))
                }
                val rows = uiState.subDomains.chunked(2)
                rows.forEach { rowItems ->
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            rowItems.forEach { sub ->
                                SubDomainCard(
                                    sub = sub,
                                    domainColor = domainColor,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onSubDomainClick(domainKey, sub.code, sub.labelEn) },
                                )
                            }
                            if (rowItems.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

            // ═══ SECTION 3: CAMPAIGNS ═══
            item {
                Spacer(Modifier.height(20.dp))
                SectionHeader(stringResource(R.string.campaigns))
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
                                color = domainColor, height = 3.dp,
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
                                        Box(Modifier.size(20.dp).clip(CircleShape).background(if (selectedTabIndex == index) domainColor else MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
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

            if (uiState.isLoading) {
                item { Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = domainColor) } }
            } else if (filteredCampaigns.isEmpty()) {
                item { Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) { Text(stringResource(R.string.no_status_campaigns, tabs[selectedTabIndex].label.lowercase()), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            } else {
                items(filteredCampaigns, key = { it.id }) { campaign ->
                    CampaignRow(campaign = campaign, domainColor = domainColor, onClick = { onCampaignClick(campaign.id) })
                }
            }

            if (uiState.error != null) {
                item { Text(uiState.error!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp)) }
            }

            // ═══ SECTION 6: RECENT ACTIVITY ═══
            if (uiState.recentActivity.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(stringResource(R.string.domain_recent_activity))
                }
                items(uiState.recentActivity.take(8)) { activity ->
                    ActivityRow(activity = activity)
                }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }

        FloatingActionButton(onClick = onNewSubmission, containerColor = domainColor, contentColor = Color.White, modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_new_submission))
        }

        AnimatedVisibility(visible = uiState.isDashboardLoading, enter = fadeIn(), exit = fadeOut()) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = domainColor)
                    Spacer(Modifier.height(16.dp))
                    Text(stringResource(R.string.loading_dashboard), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
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

@Composable
private fun DashboardSkeleton(domainColor: Color) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(2) { Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))) }
        }
        Box(Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)))
    }
}

// ── Sub-Domain Card (clickable, 2 per row) ─────────────────
@Composable
private fun SubDomainCard(sub: SubDomainUi, domainColor: Color, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(sub.labelEn, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis, color = domainColor)
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatMini(value = "${sub.campaignCount}", label = stringResource(R.string.campaigns))
                StatMini(value = "${sub.formCount}", label = stringResource(R.string.campaign_forms))
                StatMini(value = "${sub.submissionCount}", label = stringResource(R.string.submissions))
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

// ── Campaign Card (full-width, vertical layout with stats) ──
@Composable
private fun CampaignRow(campaign: Campaign, domainColor: Color, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column {
            // ── Top accent bar ──
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(domainColor),
            )

            Column(Modifier.padding(16.dp)) {
                // ── Title + Status ──
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Text(
                        campaign.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    StatusChip(status = campaign.status, domainColor = domainColor)
                }

                // ── Description ──
                campaign.description?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }

                Spacer(Modifier.height(14.dp))

                // ── Progress section ──
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Column {
                        Text(
                            "${campaign.totalSubmissions}",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = domainColor,
                        )
                        Text(
                            if (campaign.targetSubmissions != null && campaign.targetSubmissions > 0)
                                "/ ${campaign.targetSubmissions} ${stringResource(R.string.target_label)}"
                            else stringResource(R.string.submissions),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    // Percentage badge
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(domainColor.copy(alpha = 0.1f))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Text(
                            "${String.format("%.0f", campaign.completionRate)}%",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = domainColor,
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                // ── Progress bar ──
                val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                    color = domainColor,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )

                Spacer(Modifier.height(14.dp))

                // ── Stats row (Validated / Pending / Rejected) ──
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    CampaignStat(
                        value = "${campaign.validatedSubmissions}",
                        label = stringResource(R.string.validated),
                        color = Color(0xFF2E7D32),
                    )
                    CampaignStat(
                        value = "${campaign.pendingSubmissions}",
                        label = stringResource(R.string.pending),
                        color = Color(0xFFE65100),
                    )
                    CampaignStat(
                        value = "${campaign.rejectedSubmissions}",
                        label = stringResource(R.string.rejected),
                        color = Color(0xFFC62828),
                    )
                }

                // ── Dates ──
                if (campaign.startDate > 0 || campaign.endDate > 0) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        if (campaign.startDate > 0) {
                            DateLabel(label = stringResource(R.string.campaign_start), timestamp = campaign.startDate)
                        }
                        if (campaign.endDate > 0) {
                            DateLabel(label = stringResource(R.string.campaign_end), timestamp = campaign.endDate)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CampaignStat(value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = color,
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun DateLabel(label: String, timestamp: Long) {
    val formatted = remember(timestamp) {
        try {
            val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault())
            sdf.format(java.util.Date(timestamp))
        } catch (_: Exception) { "" }
    }
    if (formatted.isNotEmpty()) {
        Column {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(formatted, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
        }
    }
}

// ── KPI Bar (horizontal scrollable) ────────────────────────
@Composable
private fun KpiBar(kpis: org.auibar.aris.mobile.data.remote.api.DomainSummaryKpis, domainColor: Color) {
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { KpiChip(stringResource(R.string.domain_total_submissions), formatNumber(kpis.totalSubmissions), domainColor, kpis.trend.delta) }
        item { KpiChip(stringResource(R.string.domain_active_countries), "${kpis.activeCountries}/55", domainColor) }
        item { KpiChip(stringResource(R.string.domain_active_campaigns), "${kpis.activeCampaigns}", domainColor) }
        item { KpiChip(stringResource(R.string.domain_completion_rate), "${kpis.completionRate.toInt()}%", domainColor) }
        item { KpiChip(stringResource(R.string.domain_quality_score), "${kpis.qualityScore.toInt()}%", domainColor) }
    }
}

@Composable
private fun KpiChip(label: String, value: String, color: Color, delta: Double = 0.0) {
    Card(
        modifier = Modifier.width(140.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = color)
            if (delta != 0.0) {
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val trendColor = if (delta > 0) Color(0xFF2E7D32) else Color(0xFFC62828)
                    val trendIcon = if (delta > 0) Icons.AutoMirrored.Filled.TrendingUp else Icons.AutoMirrored.Filled.TrendingDown
                    Icon(trendIcon, contentDescription = null, modifier = Modifier.size(14.dp), tint = trendColor)
                    Spacer(Modifier.width(2.dp))
                    Text("${if (delta > 0) "+" else ""}${"%.1f".format(delta)}%", style = MaterialTheme.typography.labelSmall, color = trendColor)
                }
            }
        }
    }
}

private fun formatNumber(n: Int): String = when {
    n >= 1_000_000 -> "${"%.1f".format(n / 1_000_000.0)}M"
    n >= 1_000 -> "${"%.1f".format(n / 1_000.0)}K"
    else -> "$n"
}

// ── Monthly Trend Card ─────────────────────────────────────
@Composable
private fun MonthlyTrendCard(trend: List<MonthlyTrendEntry>, domainColor: Color) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.domain_monthly_trend), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            LineChart(
                points = trend.map { entry ->
                    val label = if (entry.month.length >= 7) entry.month.substring(5) else entry.month
                    LineChartPoint(label = label, value = entry.count.toFloat())
                },
                modifier = Modifier.fillMaxWidth().height(160.dp),
                lineColor = domainColor,
            )
        }
    }
}

// ── Sub-domain Breakdown Card (pie chart) ──────────────────
private val BREAKDOWN_COLORS = listOf(
    Color(0xFF1565C0), Color(0xFF2E7D32), Color(0xFFE65100),
    Color(0xFF6A1B9A), Color(0xFF00838F), Color(0xFFC62828),
    Color(0xFF37474F), Color(0xFF4E342E), Color(0xFFF9A825),
)

@Composable
private fun SubDomainBreakdownCard(breakdown: List<SubDomainBreakdownEntry>, domainColor: Color) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.domain_subdomain_breakdown), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            PieChart(
                slices = breakdown.mapIndexed { index, entry ->
                    PieChartSlice(
                        label = entry.label.ifBlank { entry.code },
                        value = entry.count.toFloat(),
                        color = BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.size],
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// ── Country Coverage Card (horizontal bar chart) ───────────
@Composable
private fun CountryCoverageCard(countries: List<org.auibar.aris.mobile.data.remote.api.CountryDistributionEntry>, domainColor: Color) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.domain_country_coverage), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            HorizontalBarChart(
                items = countries.take(10).mapIndexed { index, entry ->
                    BarChartItem(
                        label = entry.name.ifBlank { entry.code },
                        value = entry.count.toFloat(),
                        color = BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.size],
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// ── Activity Row ───────────────────────────────────────────
@Composable
private fun ActivityRow(activity: DomainActivityEntry) {
    val (icon, iconColor, label) = when (activity.type) {
        "submission" -> Triple(Icons.Default.Upload, Color(0xFF1565C0), stringResource(R.string.domain_activity_submission))
        "validation" -> Triple(Icons.Default.CheckCircle, Color(0xFF2E7D32), stringResource(R.string.domain_activity_validation))
        "campaign_start" -> Triple(Icons.Default.Flag, Color(0xFF6A1B9A), stringResource(R.string.domain_activity_campaign))
        else -> Triple(Icons.Default.Assessment, Color(0xFF37474F), activity.type)
    }

    val formLabel = remember(activity.formName) {
        activity.formName?.let { raw ->
            // formName may be JSON like {"en":"...", "fr":"..."} — extract simple string
            if (raw.startsWith("{")) {
                try {
                    val cleaned = raw.trim('{', '}')
                    cleaned.split(",").firstOrNull()?.split(":")?.getOrNull(1)?.trim('"', ' ') ?: raw
                } catch (_: Exception) { raw }
            } else raw
        }
    }

    val timeAgo = remember(activity.timestamp) {
        try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
            val date = sdf.parse(activity.timestamp)
            if (date != null) {
                val diff = System.currentTimeMillis() - date.time
                val minutes = diff / 60_000
                val hours = minutes / 60
                val days = hours / 24
                when {
                    minutes < 1 -> "now"
                    minutes < 60 -> "${minutes}m"
                    hours < 24 -> "${hours}h"
                    days < 30 -> "${days}d"
                    else -> java.text.SimpleDateFormat("dd MMM", java.util.Locale.getDefault()).format(date)
                }
            } else ""
        } catch (_: Exception) { "" }
    }

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(iconColor.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = iconColor)
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
            if (!formLabel.isNullOrBlank()) {
                Text(formLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (!activity.country.isNullOrBlank()) {
                Text(activity.country, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (timeAgo.isNotEmpty()) {
            Text(timeAgo, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StatusChip(status: String, domainColor: Color) {
    val (bgColor, label) = when (status.uppercase()) {
        "ACTIVE" -> Color(0xFF2E7D32) to stringResource(R.string.tab_active)
        "PLANNED" -> Color(0xFF1565C0) to stringResource(R.string.tab_planned)
        "COMPLETED" -> Color(0xFF6A1B9A) to stringResource(R.string.tab_completed)
        "CANCELLED" -> Color(0xFF757575) to stringResource(R.string.tab_archived)
        else -> domainColor to status
    }
    Box(Modifier.clip(RoundedCornerShape(8.dp)).background(bgColor.copy(alpha = 0.12f)).padding(horizontal = 8.dp, vertical = 3.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = bgColor)
    }
}
