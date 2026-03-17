package org.auibar.aris.mobile.ui.splash

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import org.auibar.aris.mobile.data.remote.websocket.WebSocketManager
import org.auibar.aris.mobile.util.AppLockManager
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val tokenManager: TokenManager,
    private val webSocketManager: WebSocketManager,
    private val appLockManager: AppLockManager,
) : ViewModel() {
    val isLoggedIn: Boolean get() = tokenManager.isLoggedIn
    val shouldShowLockScreen: Boolean get() = isLoggedIn && appLockManager.shouldLock()

    fun connectWebSocketIfNeeded() {
        if (isLoggedIn) {
            webSocketManager.connect()
        }
    }

    fun recordActivity() {
        appLockManager.recordActivity()
    }
}
