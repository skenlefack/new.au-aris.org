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
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

data class SettingsUiState(
    val userFullName: String = "",
    val userEmail: String = "",
    val userRole: String = "",
    val currentLanguage: String = "en",
    val supportedLanguages: List<LanguageOption> = emptyList(),
    val syncFrequencyMinutes: Int = 15,
    val lastSyncAt: Long? = null,
    val appVersion: String = "1.0.0",
    val cacheCleared: Boolean = false,
    val crashLogCount: Int = 0,
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
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            userFullName = tokenManager.userFullName ?: "",
            userEmail = tokenManager.userEmail ?: "",
            userRole = tokenManager.userRole ?: "",
            currentLanguage = localeManager.currentLanguage,
            supportedLanguages = localeManager.supportedLanguages,
            syncFrequencyMinutes = tokenManager.syncFrequencyMinutes,
            lastSyncAt = tokenManager.lastSyncAt,
            crashLogCount = CrashLogger.getLogFiles(appContext).size,
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
            database.clearAllTables()
            _uiState.value = _uiState.value.copy(cacheCleared = true)
        }
    }

    fun uploadCrashLogs() {
        CrashUploadWorker.enqueue(appContext)
    }

    fun logout() {
        authRepository.logout()
    }
}
