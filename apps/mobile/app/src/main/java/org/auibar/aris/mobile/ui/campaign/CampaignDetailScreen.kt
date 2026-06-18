package org.auibar.aris.mobile.ui.campaign

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.local.entity.DashboardEntity
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import org.auibar.aris.mobile.ui.components.TargetBadges
import org.auibar.aris.mobile.ui.theme.SyncConflict
import org.auibar.aris.mobile.ui.theme.SyncFailed
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ── Status colors ──────────────────────────────────────────────
private val StatusActive = Color(0xFF2E7D32)
private val StatusPlanned = Color(0xFF1565C0)
private val StatusCompleted = Color(0xFF6A1B9A)
private val StatusCancelled = Color(0xFF757575)
private val ProgressValidated = Color(0xFF4CAF50)
private val ProgressPending = Color(0xFF2196F3)
private val ProgressRejected = Color(0xFFF44336)

@Suppress("UNUSED_PARAMETER")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignDetailScreen(
    campaignId: String,
    onNewSubmission: () -> Unit,
    onBack: () -> Unit,
    onFillTemplate: ((campaignId: String, templateId: String, mode: String) -> Unit)? = null,
    viewModel: CampaignDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val submissions by viewModel.submissions.collectAsStateWithLifecycle()
    val submissionCount by viewModel.submissionCount.collectAsStateWithLifecycle()
    val campaignDashboards by viewModel.campaignDashboards.collectAsStateWithLifecycle()
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        uiState.campaignName.ifBlank { stringResource(R.string.campaign_detail) },
                        maxLines = 1,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back_button),
                        )
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::refresh) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = stringResource(R.string.cd_refresh),
                            tint = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { padding ->
        when {
            uiState.isLoading && uiState.campaignName.isBlank() -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    LoadingSpinner()
                }
            }
            uiState.error != null && uiState.campaignName.isBlank() -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            stringResource(R.string.campaign_not_found),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = onBack) {
                            Text(stringResource(R.string.go_back))
                        }
                    }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // ── Campaign Header Card ──
                    item { CampaignHeaderCard(uiState, dateFormat) }

                    // ── Progress Card ──
                    item { ProgressCard(uiState, submissionCount) }

                    // ── Form Templates Card ──
                    item {
                        val isActive = uiState.status == "ACTIVE"
                        FormTemplatesCard(
                            templates = uiState.templates,
                            isActive = isActive,
                            onFillForm = { templateId ->
                                val mode = if (isActive) "fill" else "preview"
                                if (onFillTemplate != null) {
                                    onFillTemplate(campaignId, templateId, mode)
                                } else {
                                    onNewSubmission()
                                }
                            },
                        )
                    }

                    // ── Target Countries Card ──
                    if (uiState.targetCountries.isNotEmpty()) {
                        item { TargetCountriesCard(uiState.targetCountries) }
                    }

                    // ── Campaign Dashboards ──
                    if (campaignDashboards.isNotEmpty()) {
                        item { CampaignDashboardsSection(campaignDashboards) }
                    }

                    // ── Campaign Info Card ──
                    item { CampaignInfoCard(uiState, dateFormat) }

                    // ── Submissions Section ──
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                stringResource(R.string.submissions),
                                style = MaterialTheme.typography.titleMedium,
                            )
                            if (uiState.status == "ACTIVE") {
                                Button(
                                    onClick = onNewSubmission,
                                    contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(stringResource(R.string.new_submission))
                                }
                            }
                        }
                    }

                    if (submissions.isEmpty()) {
                        item {
                            Text(
                                stringResource(R.string.no_submissions),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        items(submissions, key = { it.id }) { submission ->
                            SubmissionRow(submission)
                        }
                    }

                    // Bottom spacing
                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
        }
    }
}

// ── Campaign Header Card ───────────────────────────────────────
@Composable
private fun CampaignHeaderCard(state: CampaignDetailUiState, dateFormat: SimpleDateFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    state.campaignName,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f),
                )
                StatusBadge(state.status)
            }

            Spacer(Modifier.height(8.dp))
            if (state.targets.isNotEmpty()) {
                TargetBadges(
                    targets = state.targets,
                    maxVisible = 3,
                )
            } else {
                Text(
                    state.domainLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            if (state.startDate > 0) {
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.CalendarToday,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "${dateFormat.format(Date(state.startDate))} - ${dateFormat.format(Date(state.endDate))}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (!state.description.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    state.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Status Badge ───────────────────────────────────────────────
@Composable
private fun StatusBadge(status: String) {
    val (bgColor, label) = when (status.uppercase()) {
        "ACTIVE" -> StatusActive to stringResource(R.string.status_active)
        "PLANNED" -> StatusPlanned to stringResource(R.string.status_planned)
        "COMPLETED" -> StatusCompleted to stringResource(R.string.status_completed)
        "CANCELLED" -> StatusCancelled to stringResource(R.string.status_cancelled)
        else -> StatusCancelled to status
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = bgColor,
        )
    }
}

// ── Progress Card ──────────────────────────────────────────────
@Composable
private fun ProgressCard(state: CampaignDetailUiState, localSubmissionCount: Int) {
    val progress = state.progress
    val total = progress?.totalSubmissions ?: localSubmissionCount
    val validated = progress?.validated ?: 0
    val rejected = progress?.rejected ?: 0
    val pending = progress?.pending ?: (total - validated - rejected).coerceAtLeast(0)
    val target = state.targetSubmissions ?: total.coerceAtLeast(1)
    val completionPct = if (target > 0) (total * 100 / target).coerceAtMost(100) else 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(stringResource(R.string.progress), style = MaterialTheme.typography.titleMedium)
                Text(
                    stringResource(R.string.completion, completionPct),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            Spacer(Modifier.height(8.dp))

            // Segmented progress bar
            val progressFraction = if (target > 0) total.toFloat() / target else 0f
            LinearProgressIndicator(
                progress = { progressFraction.coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                color = ProgressValidated,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Spacer(Modifier.height(12.dp))

            // Metrics row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                MetricItem(
                    label = stringResource(R.string.submitted),
                    value = "$total",
                    color = MaterialTheme.colorScheme.primary,
                )
                MetricItem(
                    label = stringResource(R.string.validated),
                    value = "$validated",
                    color = ProgressValidated,
                )
                MetricItem(
                    label = stringResource(R.string.rejected),
                    value = "$rejected",
                    color = ProgressRejected,
                )
                MetricItem(
                    label = stringResource(R.string.pending),
                    value = "$pending",
                    color = ProgressPending,
                )
            }
        }
    }
}

@Composable
private fun MetricItem(label: String, value: String, color: Color) {
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

// ── Form Templates Card ────────────────────────────────────────
@Composable
private fun FormTemplatesCard(
    templates: List<TemplateInfo>,
    isActive: Boolean,
    onFillForm: (String) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Description,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.form_templates),
                    style = MaterialTheme.typography.titleMedium,
                )
            }

            Spacer(Modifier.height(8.dp))

            if (templates.isEmpty()) {
                Text(
                    stringResource(R.string.no_templates),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                templates.forEach { template ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                template.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                            )
                            Text(
                                "v${template.version}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (isActive) {
                            Button(
                                onClick = { onFillForm(template.id) },
                                contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    stringResource(R.string.fill_form),
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            }
                        } else {
                            OutlinedButton(
                                onClick = { onFillForm(template.id) },
                                contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    "Preview",
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Target Countries Card ──────────────────────────────────────
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TargetCountriesCard(countries: List<String>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Public,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.target_countries),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Spacer(Modifier.height(8.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                countries.forEach { code ->
                    val flag = countryCodeToFlag(code)
                    SuggestionChip(
                        onClick = {},
                        label = {
                            Text(
                                "$flag ${code.uppercase()}",
                                style = MaterialTheme.typography.labelMedium,
                            )
                        },
                    )
                }
            }
        }
    }
}

// ── Campaign Info Card ─────────────────────────────────────────
@Composable
private fun CampaignInfoCard(state: CampaignDetailUiState, dateFormat: SimpleDateFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.campaign_info),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Spacer(Modifier.height(8.dp))

            InfoRow(stringResource(R.string.campaign_domain), state.domainLabel)
            if (state.startDate > 0) {
                InfoRow(stringResource(R.string.campaign_start), dateFormat.format(Date(state.startDate)))
                InfoRow(stringResource(R.string.campaign_end), dateFormat.format(Date(state.endDate)))
            }
            state.targetSubmissions?.let {
                InfoRow(stringResource(R.string.campaign_target), "$it")
            }
            InfoRow(stringResource(R.string.campaign_forms), "${state.templates.size}")
            if (state.targetCountries.isNotEmpty()) {
                InfoRow(stringResource(R.string.campaign_countries), "${state.targetCountries.size}")
            }
            if (state.assignedAgentsCount > 0) {
                InfoRow(stringResource(R.string.campaign_agents), "${state.assignedAgentsCount}")
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
        )
    }
}

// ── Submission Row ─────────────────────────────────────────────
@Composable
private fun SubmissionRow(submission: Submission) {
    val dateFormat = remember { SimpleDateFormat("dd MMM HH:mm", Locale.getDefault()) }
    val (icon, tint, label) = when (submission.syncStatus) {
        "SYNCED" -> Triple(Icons.Default.CheckCircle, SyncSuccess, stringResource(R.string.synced))
        "FAILED" -> Triple(Icons.Default.Error, SyncFailed, stringResource(R.string.failed))
        "CONFLICT" -> Triple(Icons.Default.Warning, SyncConflict, stringResource(R.string.conflict))
        "DRAFT" -> Triple(Icons.Default.Edit, MaterialTheme.colorScheme.outline, stringResource(R.string.draft))
        else -> Triple(Icons.Default.Schedule, SyncPending, stringResource(R.string.pending))
    }

    val submissionDate = dateFormat.format(Date(submission.offlineCreatedAt))
    val cardDesc = if (submission.serverErrors != null) {
        stringResource(R.string.cd_submission_row_error, submissionDate, label, submission.serverErrors)
    } else {
        stringResource(R.string.cd_submission_row, submissionDate, label)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = cardDesc
            },
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(submissionDate, style = MaterialTheme.typography.bodyMedium)
                if (submission.serverErrors != null) {
                    Text(
                        submission.serverErrors,
                        style = MaterialTheme.typography.bodySmall,
                        color = SyncFailed,
                    )
                }
            }
            val statusDesc = stringResource(R.string.cd_status, label)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = statusDesc, tint = tint)
                Text(
                    label,
                    style = MaterialTheme.typography.labelSmall,
                    color = tint,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
        }
    }
}

// ── Campaign Dashboards Section ───────────────────────────────
@Composable
private fun CampaignDashboardsSection(dashboards: List<DashboardEntity>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.TrackChanges,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Dashboards",
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Spacer(Modifier.height(8.dp))
            dashboards.forEach { dashboard ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    ),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.Article,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.width(8.dp))
                        Column {
                            Text(
                                dashboard.titleEn.ifBlank { dashboard.titleFr },
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                            )
                            if (!dashboard.description.isNullOrBlank()) {
                                Text(
                                    dashboard.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Helper: country code → flag emoji ──────────────────────────
private fun countryCodeToFlag(code: String): String {
    val cc = code.uppercase()
    if (cc.length != 2) return ""
    val first = Character.toChars(0x1F1E6 - 'A'.code + cc[0].code)
    val second = Character.toChars(0x1F1E6 - 'A'.code + cc[1].code)
    return String(first) + String(second)
}
