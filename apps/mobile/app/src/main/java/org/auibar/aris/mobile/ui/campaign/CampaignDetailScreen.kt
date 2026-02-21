package org.auibar.aris.mobile.ui.campaign

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.ui.theme.SyncConflict
import org.auibar.aris.mobile.ui.theme.SyncFailed
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignDetailScreen(
    campaignId: String,
    onNewSubmission: () -> Unit,
    onBack: () -> Unit,
    viewModel: CampaignDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val submissions by viewModel.submissions.collectAsStateWithLifecycle()
    val submissionCount by viewModel.submissionCount.collectAsStateWithLifecycle()
    val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.campaignName.ifBlank { stringResource(R.string.campaign_detail) }) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Navigate back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = onNewSubmission) {
                Icon(Icons.Default.Add, contentDescription = "Create new submission")
                Text(
                    stringResource(R.string.new_submission),
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(uiState.campaignName, style = MaterialTheme.typography.titleLarge)
                        Text(
                            uiState.domain,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        if (uiState.startDate > 0) {
                            Text(
                                "${dateFormat.format(Date(uiState.startDate))} - ${dateFormat.format(Date(uiState.endDate))}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .semantics(mergeDescendants = true) {
                            contentDescription =
                                "Progress: $submissionCount submissions completed"
                        },
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(stringResource(R.string.progress), style = MaterialTheme.typography.titleMedium)
                            Text("$submissionCount submissions", style = MaterialTheme.typography.bodyMedium)
                        }
                        LinearProgressIndicator(
                            progress = { if (submissionCount > 0) 1f else 0f },
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        )
                    }
                }
            }

            item {
                Text(
                    stringResource(R.string.submissions),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 8.dp),
                )
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
        }
    }
}

@Composable
private fun SubmissionRow(submission: Submission) {
    val dateFormat = SimpleDateFormat("dd MMM HH:mm", Locale.getDefault())
    val (icon, tint, label) = when (submission.syncStatus) {
        "SYNCED" -> Triple(Icons.Default.CheckCircle, SyncSuccess, "Synced")
        "FAILED" -> Triple(Icons.Default.Error, SyncFailed, "Failed")
        "CONFLICT" -> Triple(Icons.Default.Warning, SyncConflict, "Conflict")
        "DRAFT" -> Triple(Icons.Default.Edit, MaterialTheme.colorScheme.outline, "Draft")
        else -> Triple(Icons.Default.Schedule, SyncPending, "Pending")
    }

    val submissionDate = dateFormat.format(Date(submission.offlineCreatedAt))

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription =
                    "Submission from $submissionDate, Status: $label" +
                            if (submission.serverErrors != null) ", Error: ${submission.serverErrors}" else ""
            },
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    submissionDate,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (submission.serverErrors != null) {
                    Text(
                        submission.serverErrors,
                        style = MaterialTheme.typography.bodySmall,
                        color = SyncFailed,
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = "$label status", tint = tint)
                Text(label, style = MaterialTheme.typography.labelSmall, color = tint, modifier = Modifier.padding(start = 4.dp))
            }
        }
    }
}
