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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.DomainIcon
import org.auibar.aris.mobile.ui.components.arisDomains

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
    viewModel: DomainDashboardViewModel = hiltViewModel(),
) {
    val campaigns by viewModel.campaigns.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val domainInfo = remember(domainKey) { arisDomains.find { it.key == domainKey } }
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
                }
            }

            // ── KPI Cards (from real data) ────────────────────────
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = stringResource(R.string.key_indicators),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            if (uiState.isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp,
                            color = domainColor,
                        )
                    }
                }
            } else {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(
                            label = stringResource(R.string.active_campaigns),
                            value = uiState.activeCampaigns.toString(),
                            icon = Icons.Default.Campaign,
                            color = domainColor,
                            modifier = Modifier.weight(1f),
                        )
                        KpiCard(
                            label = stringResource(R.string.total_submissions_label),
                            value = uiState.totalSubmissions.toString(),
                            icon = Icons.Default.CheckCircle,
                            color = Color(0xFF2E7D32),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(
                            label = stringResource(R.string.completion_rate),
                            value = "${uiState.completionRate}%",
                            icon = Icons.Default.Assessment,
                            color = Color(0xFF1565C0),
                            modifier = Modifier.weight(1f),
                        )
                        KpiCard(
                            label = stringResource(R.string.total_campaigns),
                            value = uiState.totalCampaigns.toString(),
                            icon = Icons.Default.Description,
                            color = Color(0xFFE65100),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // ── Quick Links ────────────────────────────────────────
            if (config.quickLinks.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(
                        text = stringResource(R.string.quick_access),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(config.quickLinks) { link ->
                            QuickLinkCard(
                                link = link,
                                domainColor = domainColor,
                                onClick = {
                                    when (link.action) {
                                        "campaigns" -> onNewSubmission()
                                        "reports" -> onReports()
                                        "map" -> onMap()
                                        else -> onDomainForm(link.action)
                                    }
                                },
                            )
                        }
                    }
                }
            }

            // ── Active Campaigns (with progress) ──────────────────
            item {
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    text = stringResource(R.string.active_campaigns),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            if (uiState.isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
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
                        text = stringResource(R.string.no_domain_campaigns),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            } else {
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(campaigns, key = { it.id }) { campaign ->
                            DomainCampaignCard(
                                campaign = campaign,
                                domainColor = domainColor,
                                onClick = { onCampaignClick(campaign.id) },
                            )
                        }
                    }
                }
            }

            // ── Form Templates Catalog ─────────────────────────────
            if (uiState.formTemplates.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(
                        text = stringResource(R.string.form_catalog),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
                item {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        uiState.formTemplates.forEach { template ->
                            FormTemplateCard(
                                template = template,
                                domainColor = domainColor,
                                onFill = { onFillTemplate(template.id) },
                            )
                        }
                    }
                }
            }

            // ── Error message ──────────────────────────────────────
            if (uiState.error != null) {
                item {
                    Text(
                        text = uiState.error!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
        }

        FloatingActionButton(
            onClick = onNewSubmission,
            containerColor = domainColor,
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
        ) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_new_submission))
        }
    }
}

// ── KPI Card ───────────────────────────────────────────────────────
@Composable
private fun KpiCard(
    label: String,
    value: String,
    icon: ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = value,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

// ── Quick Link Card ────────────────────────────────────────────────
@Composable
private fun QuickLinkCard(
    link: DomainQuickLink,
    domainColor: Color,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .width(130.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(domainColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(link.icon, contentDescription = null, tint = domainColor, modifier = Modifier.size(24.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = link.label,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

// ── Domain Campaign Card (with progress) ───────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DomainCampaignCard(
    campaign: Campaign,
    domainColor: Color,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.width(220.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(domainColor),
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = campaign.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )

            if (!campaign.description.isNullOrBlank()) {
                Text(
                    text = campaign.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }

            if (campaign.totalSubmissions > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = domainColor,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${campaign.validatedSubmissions}/${campaign.totalSubmissions} submissions",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = campaign.status,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Form Template Card ─────────────────────────────────────────────
@Composable
private fun FormTemplateCard(
    template: FormTemplateSummaryDto,
    domainColor: Color,
    onFill: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(domainColor.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Description,
                    contentDescription = null,
                    tint = domainColor,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = template.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "v${template.version} \u2022 ${template.formType.lowercase().replace("_", " ")}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Card(
                modifier = Modifier.clickable(onClick = onFill),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = domainColor),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = stringResource(R.string.fill),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                    )
                }
            }
        }
    }
}
