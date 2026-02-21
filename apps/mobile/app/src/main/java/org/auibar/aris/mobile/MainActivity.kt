package org.auibar.aris.mobile

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.websocket.WebSocketManager
import org.auibar.aris.mobile.data.repository.NotificationRepository
import org.auibar.aris.mobile.ui.components.OfflineBanner
import org.auibar.aris.mobile.ui.components.UpdatePromptDialog
import org.auibar.aris.mobile.ui.navigation.ArisNavGraph
import org.auibar.aris.mobile.ui.navigation.ArisRoutes
import org.auibar.aris.mobile.ui.theme.ArisTheme
import org.auibar.aris.mobile.util.AppUpdateManager
import org.auibar.aris.mobile.util.ConnectivityObserver
import org.auibar.aris.mobile.util.LocaleManager
import org.auibar.aris.mobile.util.NotificationHelper
import org.auibar.aris.mobile.util.TokenManager
import org.auibar.aris.mobile.util.UpdateInfo
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

    @Inject
    lateinit var appUpdateManager: AppUpdateManager

    private val pendingUpdateInfo = mutableStateOf<UpdateInfo?>(null)

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

        // Check for app updates
        lifecycleScope.launch {
            val update = appUpdateManager.checkForUpdate()
            if (update != null) {
                pendingUpdateInfo.value = update
            }
        }

        setContent {
            ArisTheme {
                // Update prompt dialog
                val updateInfo = pendingUpdateInfo.value
                if (updateInfo != null) {
                    UpdatePromptDialog(
                        updateInfo = updateInfo,
                        onUpdate = {
                            appUpdateManager.openUpdateUrl(updateInfo.downloadUrl)
                        },
                        onDismiss = {
                            pendingUpdateInfo.value = null
                        },
                    )
                }

                val isOnline by connectivityObserver.isOnline.collectAsStateWithLifecycle(
                    initialValue = true,
                )
                Column(modifier = Modifier.fillMaxSize()) {
                    OfflineBanner(isOffline = !isOnline)
                    val navController = rememberNavController()
                    ArisNavGraph(
                        navController = navController,
                        startDestination = ArisRoutes.SPLASH,
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Navigation framework handles deep link via intent automatically
    }

    override fun onDestroy() {
        super.onDestroy()
        webSocketManager.disconnect()
    }
}
