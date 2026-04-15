package org.auibar.aris.mobile.ui.campaign

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.ui.components.SyncIndicator
import org.auibar.aris.mobile.ui.components.arisDomains
import androidx.compose.foundation.layout.defaultMinSize
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignListScreen(
    onCampaignClick: (String) -> Unit,
    onSubmissionsClick: () -> Unit,
    onLogout: () -> Unit,
    viewModel: CampaignListViewModel = hiltViewModel(),
) {
    val campaigns by viewModel.campaigns.collectAsStateWithLifecycle()
    val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.campaigns)) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                actions = {
                    SyncIndicator(
                        pendingCount = pendingCount,
                        lastSyncAt = viewModel.lastSyncAt,
                    )
                    IconButton(onClick = viewModel::sync) {
                        Icon(Icons.Default.Sync, contentDescription = stringResource(R.string.cd_sync_data))
                    }
                    IconButton(onClick = onSubmissionsClick) {
                        Icon(Icons.AutoMirrored.Filled.Assignment, contentDescription = stringResource(R.string.cd_view_submissions))
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = stringResource(R.string.cd_sign_out))
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (uiState.isRefreshing && campaigns.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = stringResource(R.string.loading),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else if (campaigns.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = if (uiState.error != null) uiState.error!! else stringResource(R.string.no_campaigns),
                        style = MaterialTheme.typography.bodyLarge,
                        color = if (uiState.error != null) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                ) {
                    items(campaigns, key = { it.id }) { campaign ->
                        CampaignCard(
                            campaign = campaign,
                            onClick = { onCampaignClick(campaign.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CampaignCard(
    campaign: Campaign,
    onClick: () -> Unit,
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    val startDateStr = if (campaign.startDate > 0) dateFormat.format(Date(campaign.startDate)) else "—"
    val endDateStr = if (campaign.endDate > 0) dateFormat.format(Date(campaign.endDate)) else "—"
    val domainColor = arisDomains.find { campaign.domain.lowercase().contains(it.key) }?.color
        ?: MaterialTheme.colorScheme.primary

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .semantics(mergeDescendants = true) {
                contentDescription =
                    "Campaign: ${campaign.name}, Domain: ${campaign.domain}, From $startDateStr to $endDateStr"
            }
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Domain accent bar
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
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
            )

            if (!campaign.description.isNullOrBlank()) {
                Text(
                    text = campaign.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = campaign.domain,
                    style = MaterialTheme.typography.labelLarge,
                    color = domainColor,
                )
                Text(
                    text = "$startDateStr - $endDateStr",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Progress bar (only shown if there are submissions)
            if (campaign.totalSubmissions > 0) {
                Spacer(modifier = Modifier.height(10.dp))
                val progress = (campaign.completionRate / 100.0).coerceIn(0.0, 1.0).toFloat()
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = domainColor,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "${campaign.validatedSubmissions}/${campaign.totalSubmissions} submissions",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = "${String.format("%.0f", campaign.completionRate)}%",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = domainColor,
                    )
                }
            }
        }
    }
}
