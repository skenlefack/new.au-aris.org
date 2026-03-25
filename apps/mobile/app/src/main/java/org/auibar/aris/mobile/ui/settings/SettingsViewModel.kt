package org.auibar.aris.mobile.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.content.Context
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.ArisDatabase
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.sync.CrashUploadWorker
import org.auibar.aris.mobile.util.CrashLogger
import org.auibar.aris.mobile.util.LanguageOption
import org.auibar.aris.mobile.util.LocaleManager
import org.auibar.aris.mobile.util.AppLockManager
import org.auibar.aris.mobile.util.ServerEnvironment
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

data class SettingsUiState(
    val userFullName: String = "",
    val userEmail: String = "",
    val userRole: String = "",
    val tenantLevel: String = "",
    val currentLanguage: String = "en",
    val supportedLanguages: List<LanguageOption> = emptyList(),
    val syncFrequencyMinutes: Int = 15,
    val lastSyncAt: Long? = null,
    val appVersion: String = "1.0.0",
    val cacheCleared: Boolean = false,
    val crashLogCount: Int = 0,
    val isPinEnabled: Boolean = false,
    val serverEnvironment: ServerEnvironment = ServerEnvironment.PRODUCTION,
    val userDomains: List<String> = emptyList(),
)

data class SyncFrequencyOption(
    val minutes: Int,
    val labelKey: String,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val tokenManager: TokenManager,
    private val localeManager: LocaleManager,
    private val authRepository: AuthRepository,
    private val database: ArisDatabase,
    private val appLockManager: AppLockManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            userFullName = tokenManager.userFullName ?: "",
            userEmail = tokenManager.userEmail ?: "",
            userRole = tokenManager.userRole ?: "",
            tenantLevel = tokenManager.tenantLevel ?: "",
            currentLanguage = localeManager.currentLanguage,
            supportedLanguages = localeManager.supportedLanguages,
            syncFrequencyMinutes = tokenManager.syncFrequencyMinutes,
            lastSyncAt = tokenManager.lastSyncAt,
            crashLogCount = CrashLogger.getLogFiles(appContext).size,
            isPinEnabled = appLockManager.isPinEnabled,
            serverEnvironment = ServerEnvironment.fromName(tokenManager.serverEnvironment),
            userDomains = tokenManager.getUserDomainList(),
        )
    )
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    val syncFrequencyOptions = listOf(
        SyncFrequencyOption(15, "15 min"),
        SyncFrequencyOption(30, "30 min"),
        SyncFrequencyOption(60, "1 hour"),
        SyncFrequencyOption(0, "Manual"),
    )

    /**
     * Returns true if a language change occurred (requires activity restart).
     */
    fun setLanguage(languageCode: String): Boolean {
        val changed = localeManager.currentLanguage != languageCode
        localeManager.setLanguage(languageCode)
        _uiState.value = _uiState.value.copy(currentLanguage = languageCode)
        return changed
    }

    fun setSyncFrequency(minutes: Int) {
        tokenManager.syncFrequencyMinutes = minutes
        _uiState.value = _uiState.value.copy(syncFrequencyMinutes = minutes)
    }

    fun clearCache() {
        viewModelScope.launch {
            // Clear only reference/cache tables — keep pending/draft submissions & their photos
            database.campaignDao().deleteAll()
            database.formTemplateDao().deleteAll()
            database.speciesDao().deleteAll()
            database.diseaseDao().deleteAll()
            database.geoDao().deleteAll()
            database.notificationDao().deleteAll()
            database.messageDao().deleteAll()
            // Only remove already-synced submissions and uploaded photos
            database.submissionDao().deleteSynced()
            database.photoDao().deleteUploaded()
            _uiState.value = _uiState.value.copy(cacheCleared = true)
        }
    }

    /**
     * Switch server environment. Returns true if changed (requires logout + restart).
     */
    fun setServerEnvironment(env: ServerEnvironment): Boolean {
        val current = ServerEnvironment.fromName(tokenManager.serverEnvironment)
        if (current == env) return false
        tokenManager.serverEnvironment = env.name
        // Clear auth tokens — different server, different sessions
        tokenManager.clear()
        _uiState.value = _uiState.value.copy(serverEnvironment = env)
        return true
    }

    fun uploadCrashLogs() {
        CrashUploadWorker.enqueue(appContext)
    }

    fun disablePin() {
        appLockManager.removePin()
        _uiState.value = _uiState.value.copy(isPinEnabled = false)
    }

    fun logout() {
        authRepository.logout()
    }
}
