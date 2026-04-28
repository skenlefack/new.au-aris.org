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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.ui.components.DomainIcon
import org.auibar.aris.mobile.ui.components.arisDomains

// ── Domain color metadata (matches web DOMAIN_META) ──────
private val DOMAIN_COLORS = mapOf(
    "health" to Color(0xFFC62828),
    "livestock" to Color(0xFFE65100),
    "fisheries" to Color(0xFF0277BD),
    "trade" to Color(0xFF2E7D32),
    "governance" to Color(0xFF4527A0),
    "wildlife" to Color(0xFF795548),
    "apiculture" to Color(0xFFF9A825),
    "climate" to Color(0xFF00695C),
    "knowledge" to Color(0xFF1565C0),
    "paid" to Color(0xFF1F4E79),
)

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
    val dashboardWidgets by viewModel.dashboardWidgets.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val domainInfo = remember(domainKey) { arisDomains.find { it.key == domainKey } }
    val config = viewModel.config
    val domainColor = DOMAIN_COLORS[domainKey] ?: domainInfo?.color ?: MaterialTheme.colorScheme.primary
    val domainName = domainInfo?.label ?: domainKey.replaceFirstChar { it.uppercase() }
    val domainDesc = config.subtitle

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp),
        ) {
            // ══════════════════════════════════════════════════════
            // SECTION 0: Domain Header (matches web gradient banner)
            // ══════════════════════════════════════════════════════
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(domainColor, domainColor.copy(alpha = 0.85f)),
                            ),
                        )
                        .padding(top = 4.dp, bottom = 16.dp),
                ) {
                    Column {
                        // Top bar
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button), tint = Color.White)
                            }
                            Spacer(Modifier.weight(1f))
                            IconButton(onClick = viewModel::refresh) {
                                Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.cd_refresh), tint = Color.White)
                            }
                        }
                        // Domain identity
                        Row(
                            modifier = Modifier.padding(horizontal = 20.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (domainInfo != null) {
                                    DomainIcon(icon = domainInfo.icon, color = Color.White, size = 48.dp, iconSize = 24.dp, tintedBackground = false)
                                } else {
                                    Text(domainName.first().uppercase(), style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text(domainName, style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Bold)
                                if (domainDesc.isNotEmpty()) {
                                    Text(domainDesc, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.8f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }
            }

            // ══════════════════════════════════════════════════════
            // SECTION 1: Dashboard (personalized widgets)
            // ══════════════════════════════════════════════════════
            item {
                Spacer(Modifier.height(12.dp))
                SectionHeader(
                    title = stringResource(R.string.dashboard),
                    actionLabel = stringResource(R.string.dashboards),
                    onAction = onDashboards,
                )
            }

            if (uiState.isDashboardLoading) {
                item { DashboardLoadingOverlay(domainColor) }
            } else if (dashboardWidgets.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
                    ) {
                        Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("No dashboard configured", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.height(8.dp))
                            Text("Tap to browse dashboards", style = MaterialTheme.typography.labelSmall, color = domainColor, modifier = Modifier.clickable(onClick = onDashboards))
                        }
                    }
                }
            } else {
                items(dashboardWidgets, key = { it.id }) { widget ->
                    MobileWidgetRenderer(
                        widget = widget,
                        domainColor = domainColor,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            // ══════════════════════════════════════════════════════
            // SECTION 2: Plannings (campaigns + form catalog)
            // ══════════════════════════════════════════════════════
            item {
                Spacer(Modifier.height(20.dp))
                SectionHeader(title = stringResource(R.string.active_campaigns))
            }

            if (uiState.isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = domainColor)
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
                            CampaignCard(campaign = campaign, domainColor = domainColor, onClick = { onCampaignClick(campaign.id) })
                        }
                    }
                }
            }

            // Form catalog
            if (uiState.formTemplates.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(16.dp))
                    SectionHeader(title = stringResource(R.string.form_catalog))
                }
                item {
                    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        uiState.formTemplates.forEach { template ->
                            FormTemplateRow(template = template, domainColor = domainColor, onFill = { onFillTemplate(template.id) })
                        }
                    }
                }
            }

            // ══════════════════════════════════════════════════════
            // SECTION 3: Quick Access (sub-domains / actions)
            // ══════════════════════════════════════════════════════
            if (config.quickLinks.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(20.dp))
                    SectionHeader(title = stringResource(R.string.quick_access))
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(config.quickLinks) { link ->
                            QuickActionChip(
                                label = link.label,
                                icon = link.icon,
                                color = domainColor,
                                onClick = {
                                    when (link.action) {
                                        "campaigns" -> onNewSubmission()
                                        "reports" -> onReports()
                                        "map" -> onMap()
                                        "indicators" -> onIndicators()
                                        "dashboards" -> onDashboards()
                                        "flash_alerts" -> onFlashAlerts()
                                        else -> onDomainForm(link.action)
                                    }
                                },
                            )
                        }
                    }
                }
            }

            // Error
            if (uiState.error != null) {
                item {
                    Text(uiState.error!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }

        // FAB
        FloatingActionButton(
            onClick = onNewSubmission,
            containerColor = domainColor,
            contentColor = Color.White,
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        ) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_new_submission))
        }

        // Loading overlay (matches web "Creating dashboard..." pattern)
        AnimatedVisibility(
            visible = uiState.isDashboardLoading,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = domainColor)
                    Spacer(Modifier.height(16.dp))
                    Text("Loading dashboard...", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}

// ── Section Header ────────────────────────────────────────
@Composable
private fun SectionHeader(title: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (actionLabel != null && onAction != null) {
            Text(actionLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, modifier = Modifier.clickable(onClick = onAction))
        }
    }
}

// ── Dashboard Loading Skeleton ─────────────────────────────
@Composable
private fun DashboardLoadingOverlay(domainColor: Color) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(2) {
                Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)))
            }
        }
        Box(Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)))
    }
}

// ── Campaign Card ──────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CampaignCard(campaign: Campaign, domainColor: Color, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.width(280.dp), shape = RoundedCornerShape(16.dp), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(Modifier.padding(16.dp)) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(domainColor))
            Spacer(Modifier.height(12.dp))
            Text(campaign.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            campaign.description?.let { desc ->
                if (desc.isNotBlank()) Text(desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
            }
            Spacer(Modifier.height(12.dp))
            // Progress
            val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = domainColor, trackColor = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${campaign.validatedSubmissions}/${campaign.totalSubmissions} submissions", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("${String.format("%.0f", campaign.completionRate)}%", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = domainColor)
            }
            // Status badge
            val statusColor = if (campaign.status == "ACTIVE") Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant
            Text(campaign.status, style = MaterialTheme.typography.labelSmall, color = statusColor, modifier = Modifier.padding(top = 4.dp))
        }
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

// ── Quick Action Chip ──────────────────────────────────────
@Composable
private fun QuickActionChip(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, onClick: () -> Unit) {
    Card(modifier = Modifier.clickable(onClick = onClick), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Medium)
        }
    }
}
