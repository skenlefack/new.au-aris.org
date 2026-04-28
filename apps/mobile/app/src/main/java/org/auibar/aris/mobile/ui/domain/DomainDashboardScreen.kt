package org.auibar.aris.mobile.ui.domain

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
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TrendingFlat
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.DomainIcon
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.ui.components.arisDomains
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
    val campaigns by viewModel.campaigns.collectAsStateWithLifecycle()
    val indicators by viewModel.indicators.collectAsStateWithLifecycle()
    val flashAlerts by viewModel.flashAlerts.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val domainInfo = remember(domainKey) { arisDomains.find { it.key == domainKey } }
    val backendDomain = remember(domainKey) { RoleConfig.mobileToBackendKey(domainKey) }
    val config = viewModel.config
    val domainColor = domainInfo?.color ?: MaterialTheme.colorScheme.primary

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            // ── Domain Header ─────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(domainColor)
                        .padding(horizontal = 4.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onBack, modifier = Modifier.size(36.dp)) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back_button),
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    if (domainInfo != null) {
                        DomainIcon(
                            icon = domainInfo.icon,
                            color = Color.White,
                            size = 28.dp,
                            iconSize = 16.dp,
                            tintedBackground = false,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = domainInfo?.label ?: domainKey,
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                        )
                        if (config.subtitle.isNotEmpty()) {
                            Text(
                                text = config.subtitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.7f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    IconButton(onClick = viewModel::refresh) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.cd_refresh), tint = Color.White)
                    }
                }
            }

            // ── Dashboard Builder Banner ──────────────────────────
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .clickable(onClick = onDashboards),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.Transparent,
                    ),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                brush = Brush.horizontalGradient(
                                    colors = listOf(
                                        domainColor,
                                        domainColor.copy(alpha = 0.7f),
                                    ),
                                ),
                                shape = RoundedCornerShape(12.dp),
                            )
                            .padding(16.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Dashboard,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(24.dp),
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = stringResource(R.string.dashboards),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    text = "Personalized dashboard view",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.8f),
                                )
                            }
                        }
                    }
                }
            }

            // ── KPI Cards (from real data) ────────────────────────
            item {
                Text(
                    text = stringResource(R.string.key_indicators),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            if (uiState.isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = domainColor)
                    }
                }
            } else {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(stringResource(R.string.active_campaigns), uiState.activeCampaigns.toString(), Icons.Default.Campaign, domainColor, Modifier.weight(1f))
                        KpiCard(stringResource(R.string.total_submissions_label), uiState.totalSubmissions.toString(), Icons.Default.CheckCircle, Color(0xFF2E7D32), Modifier.weight(1f))
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(stringResource(R.string.completion_rate), "${uiState.completionRate}%", Icons.Default.Assessment, Color(0xFF1565C0), Modifier.weight(1f))
                        KpiCard(stringResource(R.string.total_campaigns), uiState.totalCampaigns.toString(), Icons.Default.Description, Color(0xFFE65100), Modifier.weight(1f))
                    }
                }
            }

            // ── Indicators Section ────────────────────────────────
            if (indicators.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(stringResource(R.string.indicators), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${indicators.size} total",
                            style = MaterialTheme.typography.labelSmall,
                            color = domainColor,
                            modifier = Modifier.clickable(onClick = onIndicators),
                        )
                    }
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(indicators.take(6), key = { it.id }) { indicator ->
                            IndicatorMiniCard(indicator = indicator, domainColor = domainColor, onClick = onIndicators)
                        }
                    }
                }
            }

            // ── Quick Links ────────────────────────────────────────
            if (config.quickLinks.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(stringResource(R.string.quick_access), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(config.quickLinks) { link ->
                            QuickLinkCard(link = link, domainColor = domainColor, onClick = {
                                when (link.action) {
                                    "campaigns" -> onNewSubmission()
                                    "reports" -> onReports()
                                    "map" -> onMap()
                                    "indicators" -> onIndicators()
                                    "dashboards" -> onDashboards()
                                    "flash_alerts" -> onFlashAlerts()
                                    else -> onDomainForm(link.action)
                                }
                            })
                        }
                    }
                }
            }

            // ── Active Campaigns Carousel ──────────────────────────
            item {
                Spacer(modifier = Modifier.height(20.dp))
                Text(stringResource(R.string.active_campaigns), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
            }

            if (uiState.isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    }
                }
            } else if (campaigns.isEmpty()) {
                item {
                    Text(stringResource(R.string.no_domain_campaigns), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                }
            } else {
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(campaigns, key = { it.id }) { campaign ->
                            DomainCampaignCard(campaign = campaign, domainColor = domainColor, onClick = { onCampaignClick(campaign.id) })
                        }
                    }
                }
            }

            // ── Flash Alerts Section ──────────────────────────────
            val domainAlerts = flashAlerts.filter { it.domainCode == domainKey || it.domainCode == backendDomain }.take(3)
            if (domainAlerts.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(stringResource(R.string.flash_alerts), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${flashAlerts.size} total",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFF57C00),
                            modifier = Modifier.clickable(onClick = onFlashAlerts),
                        )
                    }
                }
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        domainAlerts.forEach { alert ->
                            FlashAlertMiniCard(alert = alert)
                        }
                    }
                }
            }

            // ── Form Templates Catalog ─────────────────────────────
            if (uiState.formTemplates.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(stringResource(R.string.form_catalog), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        uiState.formTemplates.forEach { template ->
                            FormTemplateCard(template = template, domainColor = domainColor, onFill = { onFillTemplate(template.id) })
                        }
                    }
                }
            }

            // ── Error message ──────────────────────────────────────
            if (uiState.error != null) {
                item {
                    Text(uiState.error!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }

        FloatingActionButton(
            onClick = onNewSubmission,
            containerColor = domainColor,
            contentColor = Color.White,
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        ) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_new_submission))
        }
    }
}

// ── KPI Card ───────────────────────────────────────────────────────
@Composable
private fun KpiCard(label: String, value: String, icon: ImageVector, color: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(4.dp))
                    Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                }
                Box(Modifier.size(36.dp).clip(CircleShape).background(color.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

// ── Indicator Mini Card ───────────────────────────────────────────
@Composable
private fun IndicatorMiniCard(indicator: IndicatorEntity, domainColor: Color, onClick: () -> Unit) {
    val trendIcon = when (indicator.trend) {
        "up" -> Icons.AutoMirrored.Filled.TrendingUp
        "down" -> Icons.AutoMirrored.Filled.TrendingDown
        else -> Icons.Default.TrendingFlat
    }
    val trendColor = when (indicator.trend) {
        "up" -> if (indicator.betterIsHigher) Color(0xFF4CAF50) else Color(0xFFF44336)
        "down" -> if (indicator.betterIsHigher) Color(0xFFF44336) else Color(0xFF4CAF50)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Card(
        modifier = Modifier.width(160.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(indicator.nameEn, style = MaterialTheme.typography.labelSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = indicator.lastValue?.let { formatCompact(it) } ?: "—",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = domainColor,
                )
                Spacer(Modifier.width(4.dp))
                Text(indicator.unit, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(4.dp))
            Icon(trendIcon, contentDescription = indicator.trend, tint = trendColor, modifier = Modifier.size(16.dp))
        }
    }
}

// ── Flash Alert Mini Card ─────────────────────────────────────────
@Composable
private fun FlashAlertMiniCard(alert: FlashAlertEntity) {
    val severityColor = when (alert.severity.uppercase()) {
        "CRITICAL" -> Color(0xFFD32F2F)
        "HIGH" -> Color(0xFFF57C00)
        "MEDIUM" -> Color(0xFFFFA000)
        else -> Color(0xFF4CAF50)
    }
    val dateFormat = remember { SimpleDateFormat("dd MMM HH:mm", Locale.getDefault()) }

    Card(shape = RoundedCornerShape(10.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = severityColor, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(alert.titleEn, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${alert.severity} | ${dateFormat.format(Date(alert.detectedAt))}", style = MaterialTheme.typography.labelSmall, color = severityColor)
            }
        }
    }
}

// ── Quick Link Card ────────────────────────────────────────────────
@Composable
private fun QuickLinkCard(link: DomainQuickLink, domainColor: Color, onClick: () -> Unit) {
    Card(modifier = Modifier.width(110.dp).clickable(onClick = onClick), shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(domainColor.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Icon(link.icon, contentDescription = null, tint = domainColor, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.height(6.dp))
            Text(link.label, style = MaterialTheme.typography.labelSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium)
        }
    }
}

// ── Domain Campaign Card (with progress) ───────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DomainCampaignCard(campaign: Campaign, domainColor: Color, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.width(260.dp), shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(domainColor))
            Spacer(Modifier.height(10.dp))
            Text(campaign.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (!campaign.description.isNullOrBlank()) {
                Text(campaign.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
            }
            Spacer(Modifier.height(10.dp))
            val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = domainColor, trackColor = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${campaign.validatedSubmissions}/${campaign.totalSubmissions}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("${String.format("%.0f", campaign.completionRate)}%", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = domainColor)
            }
            Text(campaign.status, style = MaterialTheme.typography.labelSmall, color = if (campaign.status == "ACTIVE") Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

// ── Form Template Card ─────────────────────────────────────────────
@Composable
private fun FormTemplateCard(template: FormTemplateSummaryDto, domainColor: Color, onFill: () -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(domainColor.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Description, contentDescription = null, tint = domainColor, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(template.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("v${template.version} \u2022 ${template.formType.lowercase().replace("_", " ")}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.width(8.dp))
            Card(Modifier.clickable(onClick = onFill), shape = RoundedCornerShape(8.dp), colors = CardDefaults.cardColors(containerColor = domainColor)) {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Edit, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.fill), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = Color.White)
                }
            }
        }
    }
}

private fun formatCompact(value: Double): String {
    return if (value >= 1_000_000) String.format("%.1fM", value / 1_000_000)
    else if (value >= 1_000) String.format("%.1fK", value / 1_000)
    else String.format("%.0f", value)
}
