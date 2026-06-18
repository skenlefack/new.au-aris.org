package org.auibar.aris.mobile.ui.navigation

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.sync.SyncWorker
import org.auibar.aris.mobile.util.LocaleManager
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@HiltViewModel
class AppBannerViewModel @Inject constructor(
    private val tokenManager: TokenManager,
    private val authRepository: AuthRepository,
    private val submissionDao: SubmissionDao,
    @ApplicationContext private val appContext: Context,
    val localeManager: LocaleManager,
) : ViewModel() {

    val userName: String get() = tokenManager.userFullName ?: ""
    val userEmail: String get() = tokenManager.userEmail ?: ""
    val userRole: String? get() = tokenManager.userRole
    val tenantLevel: String? get() = tokenManager.tenantLevel
    val isLoggedIn: Boolean get() = tokenManager.isLoggedIn

    /** Pending submission count for SyncStatusBar. */
    val pendingCount: StateFlow<Int> = submissionDao.getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    /** Last sync epoch ms. */
    val lastSyncTime: Long? get() = tokenManager.lastSyncAt?.takeIf { it > 0 }

    /** Whether a sync is currently running. */
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    fun triggerSync() {
        _isSyncing.value = true
        SyncWorker.triggerNow(appContext)
        // Reset after a short delay (WorkManager handles actual completion)
        viewModelScope.launch {
            kotlinx.coroutines.delay(3000)
            _isSyncing.value = false
        }
    }

    fun logout() {
        authRepository.logout()
    }
}
