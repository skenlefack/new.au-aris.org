package org.auibar.aris.mobile.ui.validation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import org.auibar.aris.mobile.data.remote.api.ValidationItemDto

/* ── Color constants matching web ──────────────────────────────── */

private val AmberLight = Color(0xFFFFF8E1)
private val AmberDark = Color(0xFFE65100)
private val GreenLight = Color(0xFFE8F5E9)
private val GreenDark = Color(0xFF2E7D32)
private val RedLight = Color(0xFFFFEBEE)
private val RedDark = Color(0xFFC62828)
private val BlueLight = Color(0xFFE3F2FD)
private val BlueDark = Color(0xFF1565C0)
private val PurpleColor = Color(0xFF7B1FA2)
private val OrangeColor = Color(0xFFE65100)

/* ── Level / Status / Priority config ─────────────────────────── */

private data class LevelStyle(val color: Color, val dotColor: Color)

private val LEVEL_STYLES = mapOf(
    "NATIONAL_TECHNICAL" to LevelStyle(BlueDark, Color(0xFF2196F3)),
    "NATIONAL_OFFICIAL" to LevelStyle(GreenDark, Color(0xFF4CAF50)),
    "REC_HARMONIZATION" to LevelStyle(OrangeColor, Color(0xFFFF9800)),
    "CONTINENTAL_PUBLICATION" to LevelStyle(PurpleColor, Color(0xFF9C27B0)),
)

private fun levelShortLabel(level: String): String = when (level) {
    "NATIONAL_TECHNICAL" -> "L1"
    "NATIONAL_OFFICIAL" -> "L2"
    "REC_HARMONIZATION" -> "L3"
    "CONTINENTAL_PUBLICATION" -> "L4"
    else -> level.take(4)
}

private fun statusColors(status: String): Pair<Color, Color> = when (status.uppercase()) {
    "PENDING" -> AmberLight to AmberDark
    "APPROVED" -> GreenLight to GreenDark
    "REJECTED" -> RedLight to RedDark
    "RETURNED" -> BlueLight to BlueDark
    else -> Color(0xFFF5F5F5) to Color(0xFF616161)
}

@Suppress("unused")
private fun priorityDotColor(priority: String): Color = when (priority) {
    "high" -> Color(0xFFF44336)
    "medium" -> Color(0xFFFFC107)
    else -> Color(0xFF9E9E9E)
}

private fun entityBadgeColors(type: String): Pair<Color, Color> = when (type) {
    "health_event" -> Color(0xFFFFEBEE) to Color(0xFFC62828)
    "vaccination" -> Color(0xFFE0F2F1) to Color(0xFF00695C)
    "lab_result" -> Color(0xFFE8EAF6) to Color(0xFF283593)
    "census" -> Color(0xFFE8F5E9) to Color(0xFF2E7D32)
    else -> Color(0xFFF5F5F5) to Color(0xFF616161)
}

/* ── Main Screen ──────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ValidationListScreen(
    viewModel: ValidationListViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── Header ──
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = stringResource(R.string.validation_title),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = stringResource(R.string.validation_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { viewModel.loadValidations() }) {
                    Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.cd_refresh))
                }
            }
        }

        // ── KPI Cards ──
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                KpiCard(
                    icon = Icons.Default.Schedule,
                    iconTint = AmberDark,
                    iconBg = AmberLight,
                    label = stringResource(R.string.validation_pending_reviews),
                    value = "${state.pendingCount}",
                    modifier = Modifier.weight(1f),
                )
                KpiCard(
                    icon = Icons.Default.CheckCircle,
                    iconTint = GreenDark,
                    iconBg = GreenLight,
                    label = stringResource(R.string.validation_approved_week),
                    value = "${state.approvedThisWeek}",
                    modifier = Modifier.weight(1f),
                )
                KpiCard(
                    icon = Icons.Default.Timer,
                    iconTint = BlueDark,
                    iconBg = BlueLight,
                    label = stringResource(R.string.validation_avg_time),
                    value = "\u2014",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // ── Filters ──
        item {
            FilterRow(
                levelFilter = state.levelFilter,
                statusFilter = state.statusFilter,
                entityTypeFilter = state.entityTypeFilter,
                onLevelChange = viewModel::setLevelFilter,
                onStatusChange = viewModel::setStatusFilter,
                onEntityTypeChange = viewModel::setEntityTypeFilter,
            )
        }

        // ── Loading ──
        if (state.isLoading) {
            item {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
        }

        // ── Error ──
        if (state.isError) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = RedLight),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = state.errorMessage ?: stringResource(R.string.error_something_wrong),
                            modifier = Modifier.weight(1f),
                            color = RedDark,
                        )
                        TextButton(onClick = { viewModel.loadValidations() }) {
                            Text(stringResource(R.string.retry))
                        }
                    }
                }
            }
        }

        // ── Empty state ──
        if (!state.isLoading && !state.isError && state.items.isEmpty()) {
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
                        text = stringResource(R.string.validation_no_items),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.validation_no_items_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        // ── Items list ──
        items(state.items, key = { it.id }) { item ->
            ValidationItemCard(
                item = item,
                isConfirming = state.confirmingAction?.id == item.id,
                confirmingAction = state.confirmingAction?.action,
                comment = state.actionComments[item.id] ?: "",
                isPerformingAction = state.isPerformingAction,
                onApprove = { viewModel.startConfirming(item.id, "approve") },
                onReject = { viewModel.startConfirming(item.id, "reject") },
                onReturn = { viewModel.startConfirming(item.id, "return") },
                onConfirm = { viewModel.performAction() },
                onCancel = { viewModel.cancelConfirming() },
                onCommentChange = { viewModel.setActionComment(item.id, it) },
            )
        }

        // ── Pagination ──
        if (state.totalPages > 1) {
            item {
                PaginationBar(
                    page = state.page,
                    totalPages = state.totalPages,
                    total = state.total,
                    onPrevious = viewModel::previousPage,
                    onNext = viewModel::nextPage,
                )
            }
        }
    }
}

/* ── KPI Card ─────────────────────────────────────────────────── */

@Composable
private fun KpiCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    iconBg: Color,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(iconBg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/* ── Filter Row ───────────────────────────────────────────────── */

@Composable
private fun FilterRow(
    levelFilter: String?,
    statusFilter: String?,
    entityTypeFilter: String?,
    onLevelChange: (String?) -> Unit,
    onStatusChange: (String?) -> Unit,
    onEntityTypeChange: (String?) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.FilterList, contentDescription = null, modifier = Modifier.size(18.dp))

        FilterChipDropdown(
            label = levelFilter?.let { levelShortLabel(it) } ?: stringResource(R.string.validation_all_levels),
            options = listOf(
                null to stringResource(R.string.validation_all_levels),
                "NATIONAL_TECHNICAL" to "L1 — National Technical",
                "NATIONAL_OFFICIAL" to "L2 — National Official",
                "REC_HARMONIZATION" to "L3 — REC Harmonization",
                "CONTINENTAL_PUBLICATION" to "L4 — Continental",
            ),
            selected = levelFilter,
            onSelect = onLevelChange,
        )

        FilterChipDropdown(
            label = statusFilter?.replaceFirstChar { it.uppercase() }
                ?: stringResource(R.string.validation_all_statuses),
            options = listOf(
                null to stringResource(R.string.validation_all_statuses),
                "PENDING" to stringResource(R.string.workflow_pending),
                "APPROVED" to stringResource(R.string.workflow_approved),
                "REJECTED" to stringResource(R.string.workflow_rejected),
                "RETURNED" to stringResource(R.string.validation_returned),
            ),
            selected = statusFilter,
            onSelect = onStatusChange,
        )

        FilterChipDropdown(
            label = when (entityTypeFilter) {
                "health_event" -> stringResource(R.string.validation_health_event)
                "vaccination" -> stringResource(R.string.validation_vaccination)
                "lab_result" -> stringResource(R.string.validation_lab_result)
                "census" -> stringResource(R.string.validation_census)
                else -> stringResource(R.string.validation_all_types)
            },
            options = listOf(
                null to stringResource(R.string.validation_all_types),
                "health_event" to stringResource(R.string.validation_health_event),
                "vaccination" to stringResource(R.string.validation_vaccination),
                "lab_result" to stringResource(R.string.validation_lab_result),
                "census" to stringResource(R.string.validation_census),
            ),
            selected = entityTypeFilter,
            onSelect = onEntityTypeChange,
        )
    }
}

@Composable
private fun <T> FilterChipDropdown(
    label: String,
    options: List<Pair<T?, String>>,
    selected: T?,
    onSelect: (T?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val isActive = selected != null

    Box {
        OutlinedButton(
            onClick = { expanded = true },
            shape = RoundedCornerShape(20.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
            colors = if (isActive) ButtonDefaults.outlinedButtonColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
            ) else ButtonDefaults.outlinedButtonColors(),
        ) {
            Text(label, style = MaterialTheme.typography.labelMedium)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text,
                            fontWeight = if (value == selected) FontWeight.Bold else FontWeight.Normal,
                        )
                    },
                    onClick = {
                        onSelect(value)
                        expanded = false
                    },
                )
            }
        }
    }
}

/* ── Validation Item Card ─────────────────────────────────────── */

@Composable
private fun ValidationItemCard(
    item: ValidationItemDto,
    isConfirming: Boolean,
    confirmingAction: String?,
    comment: String,
    isPerformingAction: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    onReturn: () -> Unit,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
    onCommentChange: (String) -> Unit,
) {
    val (statusBg, statusFg) = statusColors(item.status)
    val level = LEVEL_STYLES[item.currentLevel] ?: LEVEL_STYLES["NATIONAL_TECHNICAL"]!!
    val (entityBg, entityFg) = entityBadgeColors(item.entityType)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // ── Title + Status badge ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.domain.replace("_", " ").replaceFirstChar { it.uppercase() }.ifEmpty { item.entityId },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.width(8.dp))
                // Status badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(statusBg)
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = item.status.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = statusFg,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ── Entity type + Level + Priority row ──
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Entity type badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(entityBg)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text(
                        text = entityTypeLabel(item.entityType),
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                        color = entityFg,
                        fontWeight = FontWeight.Medium,
                    )
                }

                // Level dot + label
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(level.dotColor),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = levelShortLabel(item.currentLevel),
                        style = MaterialTheme.typography.labelSmall,
                        color = level.color,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                // Domain badge
                if (item.domain.isNotEmpty()) {
                    Text(
                        text = item.domain.replace("_", " ").replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // ── Meta info: entity ID, created date ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = item.entityId.take(12) + "...",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (item.createdAt.isNotEmpty()) {
                    Text(
                        text = formatDate(item.createdAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // ── Actions (only for pending items) ──
            if (item.status.equals("PENDING", ignoreCase = true)) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))

                if (isConfirming) {
                    // Confirming state — show comment input + confirm/cancel
                    OutlinedTextField(
                        value = comment,
                        onValueChange = onCommentChange,
                        label = { Text(stringResource(R.string.validation_add_comment)) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(onClick = onCancel) {
                            Text(stringResource(R.string.cancel))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = onConfirm,
                            enabled = !isPerformingAction,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = when (confirmingAction) {
                                    "approve" -> GreenDark
                                    "reject" -> RedDark
                                    "return" -> BlueDark
                                    else -> MaterialTheme.colorScheme.primary
                                },
                            ),
                        ) {
                            if (isPerformingAction) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White,
                                )
                            } else {
                                Text(
                                    stringResource(R.string.confirm),
                                    color = Color.White,
                                )
                            }
                        }
                    }
                } else {
                    // Action buttons row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // Approve
                        TextButton(
                            onClick = onApprove,
                            colors = ButtonDefaults.textButtonColors(contentColor = GreenDark),
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(stringResource(R.string.validation_approve), style = MaterialTheme.typography.labelMedium)
                        }
                        // Reject
                        TextButton(
                            onClick = onReject,
                            colors = ButtonDefaults.textButtonColors(contentColor = RedDark),
                        ) {
                            Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(stringResource(R.string.validation_reject), style = MaterialTheme.typography.labelMedium)
                        }
                        // Return
                        TextButton(
                            onClick = onReturn,
                            colors = ButtonDefaults.textButtonColors(contentColor = BlueDark),
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(stringResource(R.string.validation_return), style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    }
}

/* ── Pagination ───────────────────────────────────────────────── */

@Composable
private fun PaginationBar(
    page: Int,
    totalPages: Int,
    total: Int,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.validation_page_info, page, totalPages, total),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onPrevious,
                enabled = page > 1,
                contentPadding = PaddingValues(horizontal = 12.dp),
            ) {
                Text(stringResource(R.string.validation_previous))
            }
            OutlinedButton(
                onClick = onNext,
                enabled = page < totalPages,
                contentPadding = PaddingValues(horizontal = 12.dp),
            ) {
                Text(stringResource(R.string.validation_next))
            }
        }
    }
}

/* ── Helpers ──────────────────────────────────────────────────── */

private fun entityTypeLabel(type: String): String = when (type) {
    "health_event" -> "Health Event"
    "vaccination" -> "Vaccination"
    "lab_result" -> "Lab Result"
    "census" -> "Census"
    else -> type.replace("_", " ").replaceFirstChar { it.uppercase() }
}

private fun formatDate(iso: String): String {
    return try {
        val instant = java.time.Instant.parse(iso)
        val date = java.time.LocalDate.ofInstant(instant, java.time.ZoneId.systemDefault())
        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy")
        date.format(formatter)
    } catch (_: Exception) {
        iso.take(10)
    }
}
