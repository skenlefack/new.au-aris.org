package org.auibar.aris.mobile.ui.conflict

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CallMerge
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.SyncConflict
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConflictResolutionScreen(
    submissionId: String,
    onBack: () -> Unit,
    viewModel: ConflictResolutionViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val resolvedMsg = stringResource(R.string.conflict_resolved)
    val discardedMsg = stringResource(R.string.conflict_discarded)

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is ConflictEvent.Resolved -> {
                    snackbarHostState.showSnackbar(resolvedMsg)
                    onBack()
                }
                is ConflictEvent.Discarded -> {
                    snackbarHostState.showSnackbar(discardedMsg)
                    onBack()
                }
                is ConflictEvent.Error -> {
                    snackbarHostState.showSnackbar(event.message)
                    onBack()
                }
            }
        }
    }

    // Confirmation dialog
    state.showConfirmDialog?.let { action ->
        val message = when (action) {
            ConfirmAction.KEEP_LOCAL -> stringResource(R.string.confirm_keep_local)
            ConfirmAction.ACCEPT_SERVER -> stringResource(R.string.confirm_accept_server)
            ConfirmAction.DISCARD -> stringResource(R.string.confirm_discard)
        }
        AlertDialog(
            onDismissRequest = { viewModel.dismissConfirmDialog() },
            title = { Text(stringResource(R.string.resolve_conflict)) },
            text = { Text(message) },
            confirmButton = {
                Button(
                    onClick = { viewModel.confirmAction() },
                    colors = if (action == ConfirmAction.DISCARD) {
                        ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    } else {
                        ButtonDefaults.buttonColors()
                    },
                ) {
                    Text(stringResource(R.string.confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissConfirmDialog() }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.conflict_resolution)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back_button),
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SyncConflict,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        if (state.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                // Header info
                ConflictHeader(state)

                // Field diff list
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.fields, key = { it.key }) { field ->
                        FieldDiffCard(
                            field = field,
                            onToggle = { viewModel.toggleFieldChoice(field.key) },
                        )
                    }
                }

                // Action buttons
                ActionBar(
                    onKeepLocal = { viewModel.showConfirmDialog(ConfirmAction.KEEP_LOCAL) },
                    onAcceptServer = { viewModel.showConfirmDialog(ConfirmAction.ACCEPT_SERVER) },
                    onMerge = { viewModel.resolveMerged() },
                    onDiscard = { viewModel.showConfirmDialog(ConfirmAction.DISCARD) },
                    hasDiffs = state.diffCount > 0,
                )
            }
        }
    }
}

@Composable
private fun ConflictHeader(state: ConflictUiState) {
    val dateFormat = SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault())

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = SyncConflict.copy(alpha = 0.1f),
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Warning,
                    contentDescription = null,
                    tint = SyncConflict,
                    modifier = Modifier.size(24.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.conflict_explanation),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Campaign: ${state.campaignId.take(8)}...",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "Created: ${dateFormat.format(Date(state.offlineCreatedAt))}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (state.diffCount > 0) {
                    stringResource(R.string.differences_found, state.diffCount)
                } else {
                    stringResource(R.string.all_fields_match)
                },
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = if (state.diffCount > 0) SyncConflict else MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun FieldDiffCard(
    field: FieldDiff,
    onToggle: () -> Unit,
) {
    val borderColor by animateColorAsState(
        targetValue = if (field.isDifferent) SyncConflict else MaterialTheme.colorScheme.outlineVariant,
        label = "borderColor",
    )

    val cdText = stringResource(
        R.string.cd_conflict_field,
        field.key,
        field.localValue.ifEmpty { "-" },
        field.serverValue.ifEmpty { "-" },
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (field.isDifferent) {
                    Modifier
                        .border(1.dp, borderColor, RoundedCornerShape(12.dp))
                        .clickable { onToggle() }
                } else {
                    Modifier
                },
            )
            .semantics { contentDescription = cdText },
        elevation = CardDefaults.cardElevation(defaultElevation = if (field.isDifferent) 2.dp else 0.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Field name + status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = field.key,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = if (field.isDifferent) {
                        stringResource(R.string.field_differs)
                    } else {
                        stringResource(R.string.field_same)
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = if (field.isDifferent) SyncConflict else MaterialTheme.colorScheme.outline,
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(
                            if (field.isDifferent) SyncConflict.copy(alpha = 0.12f)
                            else Color.Transparent,
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }

            if (field.isDifferent) {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))

                // Local value
                VersionRow(
                    icon = Icons.Default.PhoneAndroid,
                    label = stringResource(R.string.local_version),
                    value = field.localValue.ifEmpty { "-" },
                    isSelected = field.useLocal,
                    accentColor = MaterialTheme.colorScheme.primary,
                )

                Spacer(Modifier.height(6.dp))

                // Server value
                VersionRow(
                    icon = Icons.Default.Cloud,
                    label = stringResource(R.string.server_version),
                    value = field.serverValue.ifEmpty { "-" },
                    isSelected = !field.useLocal,
                    accentColor = SyncConflict,
                )
            } else {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = field.localValue.ifEmpty { "-" },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun VersionRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    isSelected: Boolean,
    accentColor: Color,
) {
    val bgColor by animateColorAsState(
        targetValue = if (isSelected) accentColor.copy(alpha = 0.08f) else Color.Transparent,
        label = "versionBg",
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .then(
                if (isSelected) {
                    Modifier.border(1.dp, accentColor.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                } else {
                    Modifier
                },
            )
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = if (isSelected) accentColor else MaterialTheme.colorScheme.outline,
        )
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = if (isSelected) accentColor else MaterialTheme.colorScheme.outline,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (isSelected) {
            Spacer(Modifier.width(4.dp))
            Text(
                text = "\u2713",
                color = accentColor,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ActionBar(
    onKeepLocal: () -> Unit,
    onAcceptServer: () -> Unit,
    onMerge: () -> Unit,
    onDiscard: () -> Unit,
    hasDiffs: Boolean,
) {
    HorizontalDivider()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Primary row: Keep Local / Accept Server
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = onKeepLocal,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                ),
            ) {
                Icon(Icons.Default.PhoneAndroid, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.keep_local), maxLines = 1)
            }
            OutlinedButton(
                onClick = onAcceptServer,
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.Cloud, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.accept_server), maxLines = 1)
            }
        }

        // Secondary row: Merge / Discard
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (hasDiffs) {
                Button(
                    onClick = onMerge,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SyncConflict,
                    ),
                ) {
                    Icon(Icons.Default.CallMerge, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.merge_manual), maxLines = 1)
                }
            }
            OutlinedButton(
                onClick = onDiscard,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.discard_submission), maxLines = 1)
            }
        }
    }
}
