package org.auibar.aris.mobile.ui.tenant

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.WorkflowLevel1
import org.auibar.aris.mobile.ui.theme.WorkflowLevel2
import org.auibar.aris.mobile.ui.theme.WorkflowLevel3
import org.auibar.aris.mobile.ui.theme.WorkflowLevel4

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TenantHierarchyScreen(
    onBack: () -> Unit,
    viewModel: TenantHierarchyViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tenant_hierarchy)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back_button),
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
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Current context card
                item {
                    CurrentContextCard(
                        tenantName = state.currentTenantName,
                        userRole = state.userRole,
                        userName = state.userName,
                    )
                }

                item { Spacer(Modifier.height(8.dp)) }

                // Hierarchy tree
                items(state.continentalNodes) { node ->
                    TenantNodeItem(
                        node = node,
                        depth = 0,
                        expandedIds = state.expandedIds,
                        currentTenantId = state.currentTenantId,
                        onToggle = { viewModel.toggleExpanded(it) },
                    )
                }
            }
        }
    }
}

@Composable
private fun CurrentContextCard(
    tenantName: String?,
    userRole: String?,
    userName: String?,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(28.dp),
                )
            }

            Spacer(Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = userName ?: stringResource(R.string.unknown_user),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                if (userRole != null) {
                    Text(
                        text = userRole.replace("_", " "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                Text(
                    text = stringResource(R.string.current_tenant, tenantName ?: "—"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}

@Composable
private fun TenantNodeItem(
    node: TenantNode,
    depth: Int,
    expandedIds: Set<String>,
    currentTenantId: String?,
    onToggle: (String) -> Unit,
) {
    val isExpanded = node.geo.id in expandedIds
    val hasChildren = node.children.isNotEmpty()
    val isCurrentTenant = node.geo.id == currentTenantId
    val indentDp = (depth * 24).dp

    val (levelIcon, levelColor) = when (node.geo.level) {
        "CONTINENTAL" -> Icons.Default.AccountBalance to WorkflowLevel4
        "REC" -> Icons.Default.Hub to WorkflowLevel3
        "MEMBER_STATE" -> Icons.Default.Flag to WorkflowLevel1
        else -> Icons.Default.LocationOn to WorkflowLevel2
    }

    Column(modifier = Modifier.padding(start = indentDp)) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (hasChildren) Modifier.clickable { onToggle(node.geo.id) } else Modifier,
                ),
            colors = CardDefaults.cardColors(
                containerColor = if (isCurrentTenant) {
                    MaterialTheme.colorScheme.secondaryContainer
                } else {
                    MaterialTheme.colorScheme.surface
                },
            ),
            elevation = CardDefaults.cardElevation(
                defaultElevation = if (isCurrentTenant) 4.dp else 1.dp,
            ),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = levelIcon,
                    contentDescription = null,
                    tint = levelColor,
                    modifier = Modifier.size(24.dp),
                )

                Spacer(Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = node.geo.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (isCurrentTenant) FontWeight.Bold else FontWeight.Normal,
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = levelLabel(node.geo.level),
                            style = MaterialTheme.typography.labelSmall,
                            color = levelColor,
                        )
                        if (node.geo.isoCode != null) {
                            Text(
                                text = node.geo.isoCode,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (isCurrentTenant) {
                            Text(
                                text = "(\u2713)",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }

                if (hasChildren) {
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.ExpandMore else Icons.Default.ChevronRight,
                        contentDescription = if (isExpanded) "Collapse" else "Expand",
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
        }

        // Animated children
        AnimatedVisibility(
            visible = isExpanded && hasChildren,
            enter = expandVertically(),
            exit = shrinkVertically(),
        ) {
            Column(
                modifier = Modifier.padding(top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                node.children.forEach { child ->
                    TenantNodeItem(
                        node = child,
                        depth = depth + 1,
                        expandedIds = expandedIds,
                        currentTenantId = currentTenantId,
                        onToggle = onToggle,
                    )
                }
            }
        }
    }
}

@Composable
private fun levelLabel(level: String): String = when (level) {
    "CONTINENTAL" -> stringResource(R.string.continental)
    "REC" -> stringResource(R.string.rec_level)
    "MEMBER_STATE" -> stringResource(R.string.member_state)
    else -> level
}
