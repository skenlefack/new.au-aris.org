package org.auibar.aris.mobile.ui.splash

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val tokenManager: TokenManager,
) : ViewModel() {
    val isLoggedIn: Boolean get() = tokenManager.isLoggedIn
}
