package org.auibar.aris.mobile.service

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.data.remote.websocket.RealtimeEvent
import org.auibar.aris.mobile.util.NotificationHelper
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

@AndroidEntryPoint
class ArisFirebaseMessagingService : FirebaseMessagingService() {

    @Inject lateinit var notificationHelper: NotificationHelper
    @Inject lateinit var notificationDao: NotificationDao
    @Inject lateinit var tokenManager: TokenManager

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed")
        tokenManager.fcmToken = token
        // Token will be sent to backend on next API call via header or dedicated endpoint
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received: ${message.data}")

        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: "ARIS Notification"
        val body = data["body"] ?: message.notification?.body ?: ""
        val type = data["type"] ?: "general"
        val entityId = data["entityId"]

        // Show system notification
        notificationHelper.showNotification(
            RealtimeEvent(
                type = type,
                title = title,
                body = body,
                payload = data.filterKeys { it != "type" && it != "title" && it != "body" },
            )
        )

        // Persist to Room DB for in-app notification list
        serviceScope.launch {
            notificationDao.insert(
                NotificationEntity(
                    id = data["notificationId"] ?: UUID.randomUUID().toString(),
                    tenantId = tokenManager.tenantId ?: "",
                    type = type,
                    title = title,
                    body = body,
                    isRead = false,
                    createdAt = System.currentTimeMillis(),
                )
            )
        }
    }

    companion object {
        private const val TAG = "ArisFCM"
    }
}
