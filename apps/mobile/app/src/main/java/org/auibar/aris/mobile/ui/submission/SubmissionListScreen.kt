package org.auibar.aris.mobile.ui.submission

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.ui.components.QualityGatesCard
import org.auibar.aris.mobile.ui.components.WorkflowStatusBar
import org.auibar.aris.mobile.ui.theme.SyncConflict
import org.auibar.aris.mobile.ui.theme.SyncFailed
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess
import org.auibar.aris.mobile.util.PdfExporter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubmissionListScreen(
    onBack: () -> Unit,
    onConflictClick: (submissionId: String) -> Unit = {},
    viewModel: SubmissionListViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.submissions)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Navigate back",
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            // Search bar
            OutlinedTextField(
                value = state.filter.query,
                onValueChange = { viewModel.setQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text(stringResource(R.string.search_submissions)) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.filter.query.isNotBlank()) {
                        IconButton(onClick = { viewModel.setQuery("") }) {
                            Icon(Icons.Default.Clear, contentDescription = null)
                        }
                    }
                },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(),
            )

            // Filter chips row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Status chips
                FilterChip(
                    selected = state.filter.statusFilter == null,
                    onClick = { viewModel.setStatusFilter(null) },
                    label = { Text(stringResource(R.string.filter_all)) },
                )
                state.availableStatuses.forEach { status ->
                    FilterChip(
                        selected = state.filter.statusFilter == status,
                        onClick = {
                            viewModel.setStatusFilter(
                                if (state.filter.statusFilter == status) null else status,
                            )
                        },
                        label = { Text(status) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = statusColor(status).copy(alpha = 0.15f),
                        ),
                    )
                }

                // Domain chips
                state.availableDomains.forEach { domain ->
                    FilterChip(
                        selected = state.filter.domainFilter == domain,
                        onClick = {
                            viewModel.setDomainFilter(
                                if (state.filter.domainFilter == domain) null else domain,
                            )
                        },
                        label = { Text(domain) },
                    )
                }
            }

            // Clear filters button
            if (state.filter.isActive) {
                TextButton(
                    onClick = { viewModel.clearFilters() },
                    modifier = Modifier.padding(horizontal = 16.dp),
                ) {
                    Icon(Icons.Default.Clear, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "${stringResource(R.string.clear_filters)} (${state.filteredSubmissions.size}/${state.allSubmissions.size})",
                    )
                }
            }

            // List
            if (state.filteredSubmissions.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = stringResource(R.string.no_submissions),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                ) {
                    items(state.filteredSubmissions, key = { it.id }) { submission ->
                        SubmissionCard(
                            submission = submission,
                            onClick = if (submission.syncStatus == "CONFLICT") {
                                { onConflictClick(submission.id) }
                            } else {
                                null
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SubmissionCard(
    submission: Submission,
    onClick: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val dateFormat = SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault())

    val (icon, tint, label) = when (submission.syncStatus) {
        "SYNCED" -> Triple(Icons.Default.CheckCircle, SyncSuccess, "Synced")
        "FAILED" -> Triple(Icons.Default.Error, SyncFailed, "Failed")
        "CONFLICT" -> Triple(Icons.Default.Warning, SyncConflict, "Conflict")
        else -> Triple(Icons.Default.Schedule, SyncPending, "Pending")
    }
    val submissionDate = dateFormat.format(Date(submission.offlineCreatedAt))
    val exportSuccessMsg = stringResource(R.string.export_success)
    val exportErrorMsg = stringResource(R.string.export_error)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (onClick != null) Modifier.clickable { onClick() } else Modifier,
            )
            .semantics(mergeDescendants = true) {
                contentDescription =
                    "Submission for campaign ${submission.campaignId.take(8)}, " +
                            "Date: $submissionDate, Status: $label" +
                            if (submission.serverErrors != null) ", Error: ${submission.serverErrors}" else ""
            },
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Campaign: ${submission.campaignId.take(8)}...",
                    style = MaterialTheme.typography.titleSmall,
                )
                if (submission.domain != null) {
                    Text(
                        text = submission.domain,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Text(
                    text = submissionDate,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (submission.serverErrors != null) {
                    Text(
                        text = submission.serverErrors,
                        style = MaterialTheme.typography.bodySmall,
                        color = SyncFailed,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                if (submission.syncStatus == "CONFLICT") {
                    Text(
                        text = stringResource(R.string.tap_to_resolve),
                        style = MaterialTheme.typography.labelSmall,
                        color = SyncConflict,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = icon,
                    contentDescription = "$label status",
                    tint = tint,
                    modifier = Modifier.size(28.dp),
                )
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = tint,
                )
                Spacer(Modifier.height(4.dp))
                IconButton(
                    onClick = {
                        val file = PdfExporter.exportSubmission(context, submission)
                        if (file != null) {
                            PdfExporter.shareFile(context, file)
                        } else {
                            Toast.makeText(context, exportErrorMsg, Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.size(32.dp),
                ) {
                    Icon(
                        imageVector = Icons.Default.PictureAsPdf,
                        contentDescription = stringResource(R.string.export_pdf),
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }

        // Workflow pipeline (shown when submission is synced and has workflow data)
        if (submission.syncStatus == "SYNCED" && submission.workflowLevel > 0) {
            HorizontalDivider(modifier = Modifier.padding(horizontal = 8.dp))
            WorkflowStatusBar(
                currentLevel = submission.workflowLevel,
                workflowStatus = submission.workflowStatus,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }

        // Quality gates (shown when results are available)
        if (!submission.qualityGateResults.isNullOrBlank()) {
            HorizontalDivider(modifier = Modifier.padding(horizontal = 8.dp))
            QualityGatesCard(
                qualityGateResultsJson = submission.qualityGateResults,
                modifier = Modifier.padding(8.dp),
            )
        }
    }
}

private fun statusColor(status: String) = when (status) {
    "SYNCED" -> SyncSuccess
    "FAILED" -> SyncFailed
    "CONFLICT" -> SyncConflict
    else -> SyncPending
}
