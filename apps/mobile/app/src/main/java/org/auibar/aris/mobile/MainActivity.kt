package org.auibar.aris.mobile

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.websocket.WebSocketManager
import org.auibar.aris.mobile.data.repository.NotificationRepository
import org.auibar.aris.mobile.ui.components.OfflineBanner
import org.auibar.aris.mobile.ui.navigation.ArisNavGraph
import org.auibar.aris.mobile.ui.navigation.ArisRoutes
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.auibar.aris.mobile.util.ConnectivityObserver
import org.auibar.aris.mobile.util.LocaleManager
import org.auibar.aris.mobile.util.NotificationHelper
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var connectivityObserver: ConnectivityObserver

    @Inject
    lateinit var webSocketManager: WebSocketManager

    @Inject
    lateinit var notificationHelper: NotificationHelper

    @Inject
    lateinit var notificationRepository: NotificationRepository

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var localeManager: LocaleManager

    override fun attachBaseContext(newBase: Context) {
        // Apply locale before super to ensure correct language from the start
        // LocaleManager is not yet injected here, so read language from prefs directly
        super.attachBaseContext(newBase)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Create notification channels
        notificationHelper.createChannels()

        // If already logged in, connect WebSocket
        if (tokenManager.isLoggedIn) {
            webSocketManager.connect()
        }

        // Listen for real-time events and show Android notifications
        lifecycleScope.launch {
            webSocketManager.events.collect { event ->
                notificationHelper.showNotification(event)
                notificationRepository.insertFromEvent(event)
            }
        }

        val startDestination = if (tokenManager.isLoggedIn) {
            ArisRoutes.DASHBOARD
        } else {
            ArisRoutes.LOGIN
        }

        setContent {
            ArisTheme {
                val isOnline by connectivityObserver.isOnline.collectAsStateWithLifecycle(
                    initialValue = true,
                )
                Column(modifier = Modifier.fillMaxSize()) {
                    OfflineBanner(isOffline = !isOnline)
                    val navController = rememberNavController()
                    ArisNavGraph(
                        navController = navController,
                        startDestination = startDestination,
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webSocketManager.disconnect()
    }
}
