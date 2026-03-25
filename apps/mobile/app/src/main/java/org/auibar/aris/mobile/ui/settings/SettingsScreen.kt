package org.auibar.aris.mobile.ui.settings

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.ClearAll
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.ui.components.arisDomains
import org.auibar.aris.mobile.util.ServerEnvironment
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    onTenantHierarchy: () -> Unit = {},
    onMessages: () -> Unit = {},
    onSetPin: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var showLanguageDialog by remember { mutableStateOf(false) }
    var showSyncFreqDialog by remember { mutableStateOf(false) }
    var showClearCacheDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showEnvDialog by remember { mutableStateOf(false) }
    var pendingEnvSwitch by remember { mutableStateOf<ServerEnvironment?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(stringResource(R.string.settings)) })
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Server environment
            SettingsItem(
                icon = Icons.Default.Cloud,
                title = stringResource(R.string.server_environment),
                subtitle = stringResource(R.string.server_env_current, uiState.serverEnvironment.label),
                onClick = { showEnvDialog = true },
            )

            // Language selector
            SettingsItem(
                icon = Icons.Default.Language,
                title = stringResource(R.string.language),
                subtitle = uiState.supportedLanguages
                    .find { it.code == uiState.currentLanguage }?.displayName ?: "English",
                onClick = { showLanguageDialog = true },
            )

            // Sync frequency
            SettingsItem(
                icon = Icons.Default.Sync,
                title = stringResource(R.string.sync_frequency),
                subtitle = viewModel.syncFrequencyOptions
                    .find { it.minutes == uiState.syncFrequencyMinutes }?.labelKey ?: "15 min",
                onClick = { showSyncFreqDialog = true },
            )

            // Messages
            SettingsItem(
                icon = Icons.Default.MailOutline,
                title = stringResource(R.string.messages),
                subtitle = stringResource(R.string.new_message),
                onClick = onMessages,
            )

            // Tenant hierarchy
            SettingsItem(
                icon = Icons.Default.AccountTree,
                title = stringResource(R.string.tenant_hierarchy),
                subtitle = stringResource(R.string.switch_context),
                onClick = onTenantHierarchy,
            )

            // ── Assigned Domains ───────────────────
            if (uiState.userDomains.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text(
                        text = "Assigned Domains",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    val visibleDomains = remember(uiState.userDomains) {
                        arisDomains.filter { it.key in uiState.userDomains.map { code ->
                            RoleConfig.backendToMobileKey(code)
                        }.toSet() }
                    }
                    visibleDomains.forEach { domain ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(domain.color, CircleShape),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(
                                imageVector = domain.icon,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = domain.color,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = domain.label,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }

            // PIN lock
            SettingsItem(
                icon = if (uiState.isPinEnabled) Icons.Default.Lock else Icons.Default.LockOpen,
                title = stringResource(R.string.pin_lock),
                subtitle = if (uiState.isPinEnabled) {
                    stringResource(R.string.pin_lock_enabled)
                } else {
                    stringResource(R.string.pin_lock_disabled)
                },
                onClick = {
                    if (uiState.isPinEnabled) {
                        viewModel.disablePin()
                    } else {
                        onSetPin()
                    }
                },
            )

            // Crash reports
            if (uiState.crashLogCount > 0) {
                SettingsItem(
                    icon = Icons.Default.BugReport,
                    title = stringResource(R.string.crash_reports),
                    subtitle = stringResource(R.string.crash_count, uiState.crashLogCount),
                    onClick = {
                        viewModel.uploadCrashLogs()
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                context.getString(R.string.crash_uploading),
                            )
                        }
                    },
                )
            }

            // Clear cache
            SettingsItem(
                icon = Icons.Default.ClearAll,
                title = stringResource(R.string.clear_cache),
                subtitle = stringResource(R.string.clear_cache_desc),
                onClick = { showClearCacheDialog = true },
            )

            HorizontalDivider()

            // App info
            val settingsDateFormat = remember { SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()) }
            val lastSyncStr = uiState.lastSyncAt?.let { settingsDateFormat.format(Date(it)) }
                ?: stringResource(R.string.never)

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) { },
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = stringResource(R.string.app_version),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = uiState.appVersion,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = stringResource(R.string.last_sync),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = lastSyncStr,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }

            // Logout
            SettingsItem(
                icon = Icons.AutoMirrored.Filled.Logout,
                title = stringResource(R.string.logout),
                subtitle = "",
                onClick = { showLogoutDialog = true },
                isDestructive = true,
            )
        }
    }

    // Language dialog
    if (showLanguageDialog) {
        AlertDialog(
            onDismissRequest = { showLanguageDialog = false },
            title = { Text(stringResource(R.string.language)) },
            text = {
                Column {
                    uiState.supportedLanguages.forEach { lang ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val changed = viewModel.setLanguage(lang.code)
                                    showLanguageDialog = false
                                    if (changed) {
                                        (context as? Activity)?.recreate()
                                    }
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = lang.code == uiState.currentLanguage,
                                onClick = null,
                            )
                            Text(
                                text = lang.displayName,
                                modifier = Modifier.padding(start = 8.dp),
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showLanguageDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    // Sync frequency dialog
    if (showSyncFreqDialog) {
        AlertDialog(
            onDismissRequest = { showSyncFreqDialog = false },
            title = { Text(stringResource(R.string.sync_frequency)) },
            text = {
                Column {
                    viewModel.syncFrequencyOptions.forEach { option ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.setSyncFrequency(option.minutes)
                                    showSyncFreqDialog = false
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = option.minutes == uiState.syncFrequencyMinutes,
                                onClick = null,
                            )
                            Text(
                                text = option.labelKey,
                                modifier = Modifier.padding(start = 8.dp),
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSyncFreqDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    // Clear cache confirmation
    if (showClearCacheDialog) {
        AlertDialog(
            onDismissRequest = { showClearCacheDialog = false },
            title = { Text(stringResource(R.string.clear_cache)) },
            text = { Text(stringResource(R.string.clear_cache_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.clearCache()
                    showClearCacheDialog = false
                    scope.launch {
                        snackbarHostState.showSnackbar(
                            context.getString(R.string.cache_cleared),
                        )
                    }
                }) {
                    Text(stringResource(R.string.confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearCacheDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    // Logout confirmation
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text(stringResource(R.string.logout)) },
            text = { Text(stringResource(R.string.logout_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.logout()
                    showLogoutDialog = false
                    onLogout()
                }) {
                    Text(stringResource(R.string.logout), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    // Server environment picker
    if (showEnvDialog) {
        AlertDialog(
            onDismissRequest = { showEnvDialog = false },
            title = { Text(stringResource(R.string.server_environment)) },
            text = {
                Column {
                    ServerEnvironment.entries.forEach { env ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    showEnvDialog = false
                                    if (env != uiState.serverEnvironment) {
                                        pendingEnvSwitch = env
                                    }
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = env == uiState.serverEnvironment,
                                onClick = null,
                            )
                            Column(modifier = Modifier.padding(start = 8.dp)) {
                                Text(text = env.label, style = MaterialTheme.typography.bodyLarge)
                                Text(
                                    text = env.baseUrl,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showEnvDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }

    // Confirm environment switch (triggers logout)
    if (pendingEnvSwitch != null) {
        val targetEnv = pendingEnvSwitch!!
        AlertDialog(
            onDismissRequest = { pendingEnvSwitch = null },
            title = { Text(stringResource(R.string.server_env_switch_title)) },
            text = { Text(stringResource(R.string.server_env_switch_confirm, targetEnv.label)) },
            confirmButton = {
                TextButton(onClick = {
                    val changed = viewModel.setServerEnvironment(targetEnv)
                    pendingEnvSwitch = null
                    if (changed) {
                        onLogout()
                    }
                }) {
                    Text(stringResource(R.string.confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingEnvSwitch = null }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }
}

@Composable
private fun SettingsItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    isDestructive: Boolean = false,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = if (subtitle.isNotEmpty()) {
                    "$title, $subtitle"
                } else {
                    title
                }
            }
            .clickable { onClick() },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                icon,
                contentDescription = title,
                tint = if (isDestructive) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp),
            )
            Column(modifier = Modifier.padding(start = 16.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    color = if (isDestructive) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurface,
                )
                if (subtitle.isNotEmpty()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
