package org.auibar.aris.mobile.ui.navigation

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import org.auibar.aris.mobile.data.repository.AuthRepository
import org.auibar.aris.mobile.util.LocaleManager
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@HiltViewModel
class AppBannerViewModel @Inject constructor(
    private val tokenManager: TokenManager,
    private val authRepository: AuthRepository,
    val localeManager: LocaleManager,
) : ViewModel() {

    val userName: String get() = tokenManager.userFullName ?: ""
    val userEmail: String get() = tokenManager.userEmail ?: ""
    val userRole: String? get() = tokenManager.userRole
    val tenantLevel: String? get() = tokenManager.tenantLevel
    val isLoggedIn: Boolean get() = tokenManager.isLoggedIn

    fun logout() {
        authRepository.logout()
    }
}
