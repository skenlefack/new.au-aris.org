package org.auibar.aris.mobile.ui.dashboard

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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingFlat
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.sync.SyncWorker
import org.auibar.aris.mobile.ui.charts.SparklineChart
import org.auibar.aris.mobile.ui.components.DomainGrid
import org.auibar.aris.mobile.ui.components.DomainIcon
import org.auibar.aris.mobile.ui.components.DomainInfo
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.ui.components.arisDomains
import org.auibar.aris.mobile.ui.theme.GoldAccent
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal

@Suppress("UNUSED_PARAMETER")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onCampaignClick: (String) -> Unit,
    onNewSubmission: () -> Unit,
    onReports: () -> Unit = {},
    onSettings: () -> Unit = {},
    onLogout: () -> Unit = {},
    onDomainClick: (String) -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val campaigns by viewModel.recentCampaigns.collectAsStateWithLifecycle()
    val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val userRole = uiState.userRole
    val userDomains = uiState.userDomains
    val activeDomains = uiState.activeDomains
    val visibleDomains = remember(userRole, userDomains, activeDomains) {
        RoleConfig.visibleDomains(userRole, userDomains, activeDomains)
    }
    val canCreate = remember(userRole) { RoleConfig.canCreate(userRole) }
    val canReport = remember(userRole) { RoleConfig.canReport(userRole) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        // ── KPI cards row ────────────────────────────────────────
        if (uiState.kpis.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(12.dp))
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(uiState.kpis) { kpi ->
                        KpiMiniCard(kpi)
                    }
                }
            }
        } else if (!uiState.isLoading && pendingCount > 0) {
            item {
                PendingSubmissionsCard(
                    count = pendingCount,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                )
            }
        }

        // ── Domain Grid (filtered by role) ───────────────────────
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = stringResource(R.string.domains),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
                DomainGrid(
                    domains = visibleDomains,
                    onDomainClick = { domain -> onDomainClick(domain.key) },
                )
            }
        }

        // ── Quick Actions Row (role-based) ───────────────────────
        item {
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (canCreate) {
                    QuickActionCard(
                        icon = Icons.Default.Add,
                        label = stringResource(R.string.new_submission),
                        color = GradientMidGreen,
                        onClick = onNewSubmission,
                        modifier = Modifier.weight(1f),
                    )
                }
                QuickActionCard(
                    icon = Icons.Default.Sync,
                    label = stringResource(R.string.sync_now),
                    color = GradientTeal,
                    onClick = { SyncWorker.triggerNow(context) },
                    modifier = Modifier.weight(1f),
                )
                if (canReport) {
                    QuickActionCard(
                        icon = Icons.Default.Assessment,
                        label = stringResource(R.string.reports),
                        color = GoldAccent,
                        onClick = onReports,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        // ── Active Campaigns ─────────────────────────────────────
        item {
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = stringResource(R.string.recent_campaigns),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        if (uiState.campaignsLoading) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                    )
                }
            }
        } else if (campaigns.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.no_campaigns),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        } else {
            items(campaigns.take(8), key = { it.id }) { campaign ->
                CampaignCardFull(
                    campaign = campaign,
                    onClick = { onCampaignClick(campaign.id) },
                )
            }
        }
    }
}

// ── Pending submissions card ─────────────────────────────────────────
@Composable
private fun PendingSubmissionsCard(count: Int, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.pending_submissions),
                    style = MaterialTheme.typography.labelMedium,
                )
                Text(
                    text = "$count",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

// ── KPI mini-card ────────────────────────────────────────────────────
@Composable
private fun KpiMiniCard(kpi: KpiCard) {
    Card(
        modifier = Modifier.width(150.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f),
        ),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = kpi.label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (kpi.value == kpi.value.toLong().toDouble()) {
                    kpi.value.toLong().toString()
                } else {
                    String.format("%.1f", kpi.value)
                } + if (kpi.unit.isNotEmpty()) " ${kpi.unit}" else "",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            if (kpi.trendPercent != 0.0) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = when (kpi.trend) {
                            "up" -> Icons.AutoMirrored.Filled.TrendingUp
                            "down" -> Icons.AutoMirrored.Filled.TrendingDown
                            else -> Icons.AutoMirrored.Filled.TrendingFlat
                        },
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = when (kpi.trend) {
                            "up" -> MaterialTheme.colorScheme.error
                            "down" -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                    Text(
                        text = "${String.format("%.1f", kpi.trendPercent)}%",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(start = 2.dp),
                    )
                }
            }
            val sparklineValues = remember(kpi.key) {
                generateSparklineData(kpi.value, kpi.trend)
            }
            SparklineChart(
                values = sparklineValues,
                color = when (kpi.trend) {
                    "up" -> MaterialTheme.colorScheme.error
                    "down" -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(20.dp)
                    .padding(top = 4.dp),
            )
        }
    }
}

// ── Quick Action Card ────────────────────────────────────────────────
@Composable
private fun QuickActionCard(
    icon: ImageVector,
    label: String,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// ── Campaign Card (full-width, vertical with stats) ─────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CampaignCardFull(
    campaign: Campaign,
    onClick: () -> Unit,
) {
    val domainColor = arisDomains.find {
        campaign.domain.lowercase().contains(it.key)
    }?.color ?: MaterialTheme.colorScheme.primary

    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column {
            // Accent bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(domainColor),
            )

            Column(modifier = Modifier.padding(16.dp)) {
                // Title + Status
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = campaign.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = campaign.domain.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelSmall,
                            color = domainColor,
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    // Status chip
                    val (statusBg, statusLabel) = when (campaign.status.uppercase()) {
                        "ACTIVE" -> Color(0xFF2E7D32) to "Active"
                        "PLANNED" -> Color(0xFF1565C0) to "Planned"
                        "COMPLETED" -> Color(0xFF6A1B9A) to "Completed"
                        else -> Color(0xFF757575) to campaign.status
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(statusBg.copy(alpha = 0.12f))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    ) {
                        Text(
                            statusLabel,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = statusBg,
                        )
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Progress section: big number + percentage
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
                                "/ ${campaign.targetSubmissions} target"
                            else "submissions",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
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

                // Progress bar
                val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = domainColor,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )

                Spacer(Modifier.height(14.dp))

                // Stats row: Validated / Pending / Rejected
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    CampaignStatItem("${campaign.validatedSubmissions}", stringResource(R.string.validated), Color(0xFF2E7D32))
                    CampaignStatItem("${campaign.pendingSubmissions}", stringResource(R.string.pending), Color(0xFFE65100))
                    CampaignStatItem("${campaign.rejectedSubmissions}", stringResource(R.string.rejected), Color(0xFFC62828))
                }

                // Dates
                if (campaign.startDate > 0 || campaign.endDate > 0) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        if (campaign.startDate > 0) {
                            CampaignDateLabel(stringResource(R.string.campaign_start), campaign.startDate)
                        }
                        if (campaign.endDate > 0) {
                            CampaignDateLabel(stringResource(R.string.campaign_end), campaign.endDate)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CampaignStatItem(value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = color)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CampaignDateLabel(label: String, timestamp: Long) {
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

private fun generateSparklineData(currentValue: Double, trend: String): List<Float> {
    val baseValue = currentValue.toFloat()
    val factor = when (trend) {
        "up" -> 0.85f
        "down" -> 1.15f
        else -> 1.0f
    }
    return listOf(
        baseValue * factor * 0.9f,
        baseValue * factor * 0.95f,
        baseValue * factor,
        baseValue * (factor + (1f - factor) * 0.33f),
        baseValue * (factor + (1f - factor) * 0.66f),
        baseValue,
    )
}
