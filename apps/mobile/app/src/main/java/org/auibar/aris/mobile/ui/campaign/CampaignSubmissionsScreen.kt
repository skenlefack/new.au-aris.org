package org.auibar.aris.mobile.ui.campaign

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.remote.dto.SubmissionListItemDto

private val StatusSubmitted = Color(0xFF1565C0)
private val StatusValidated = Color(0xFF2E7D32)
private val StatusRejected = Color(0xFFC62828)
private val StatusReturned = Color(0xFFE65100)
private val StatusConflict = Color(0xFF7B1FA2)

private fun submissionStatusColors(status: String): Pair<Color, Color> = when (status.uppercase()) {
    "SUBMITTED" -> Color(0xFFE3F2FD) to StatusSubmitted
    "VALIDATED" -> Color(0xFFE8F5E9) to StatusValidated
    "REJECTED" -> Color(0xFFFFEBEE) to StatusRejected
    "RETURNED" -> Color(0xFFFFF3E0) to StatusReturned
    "CONFLICT" -> Color(0xFFF3E5F5) to StatusConflict
    else -> Color(0xFFF5F5F5) to Color(0xFF616161)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignSubmissionsScreen(
    onBack: () -> Unit,
    onSubmissionClick: (String) -> Unit = {},
    viewModel: CampaignSubmissionsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        state.campaignName.ifBlank { "Submissions" },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Filter chips
            item {
                StatusFilterChips(
                    selected = state.statusFilter,
                    onSelect = viewModel::setStatusFilter,
                )
            }

            // Loading
            if (state.isLoading) {
                item {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }

            // Error
            if (state.isError) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = state.errorMessage ?: stringResource(R.string.error_something_wrong),
                                modifier = Modifier.weight(1f),
                                color = Color(0xFFC62828),
                            )
                            TextButton(onClick = viewModel::loadSubmissions) {
                                Text(stringResource(R.string.retry))
                            }
                        }
                    }
                }
            }

            // Empty state
            if (!state.isLoading && !state.isError && state.submissions.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            Icons.Default.Inbox,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No submissions found",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = "Submissions for this campaign will appear here",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Submission items
            items(state.submissions, key = { it.id }) { submission ->
                SubmissionItemCard(
                    submission = submission,
                    onClick = { onSubmissionClick(submission.id) },
                )
            }

            // Pagination
            if (state.totalPages > 1) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Page ${state.page} of ${state.totalPages} (${state.total} total)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = viewModel::previousPage,
                                enabled = state.page > 1,
                                contentPadding = PaddingValues(horizontal = 12.dp),
                            ) {
                                Text(stringResource(R.string.validation_previous))
                            }
                            OutlinedButton(
                                onClick = viewModel::nextPage,
                                enabled = state.page < state.totalPages,
                                contentPadding = PaddingValues(horizontal = 12.dp),
                            ) {
                                Text(stringResource(R.string.validation_next))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusFilterChips(
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    val filters = listOf(
        null to "All",
        "SUBMITTED" to "Submitted",
        "VALIDATED" to "Validated",
        "REJECTED" to "Rejected",
        "RETURNED" to "Returned",
        "CONFLICT" to "Conflict",
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        filters.forEach { (value, label) ->
            FilterChip(
                selected = selected == value,
                onClick = { onSelect(value) },
                label = {
                    Text(label, style = MaterialTheme.typography.labelMedium)
                },
            )
        }
    }
}

@Composable
private fun SubmissionItemCard(
    submission: SubmissionListItemDto,
    onClick: () -> Unit,
) {
    val (statusBg, statusFg) = submissionStatusColors(submission.status)

    Card(
        modifier = Modifier
            .fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        onClick = onClick,
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = submission.id.take(12) + "...",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(statusBg)
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = submission.status.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = statusFg,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                if (submission.createdBy.isNotEmpty()) {
                    Text(
                        text = submission.createdBy.take(20) + if (submission.createdBy.length > 20) "..." else "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (submission.createdAt.isNotEmpty()) {
                    Text(
                        text = formatSubmissionDate(submission.createdAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (submission.version > 1) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "v${submission.version}",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Conflict indicator
            if (submission.conflictStatus != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color(0xFFF3E5F5))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text(
                        text = "Conflict: ${submission.conflictStatus}",
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                        color = StatusConflict,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}

private fun formatSubmissionDate(iso: String): String {
    return try {
        val instant = java.time.Instant.parse(iso)
        val date = java.time.LocalDate.ofInstant(instant, java.time.ZoneId.systemDefault())
        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy")
        date.format(formatter)
    } catch (_: Exception) {
        iso.take(10)
    }
}
