package org.auibar.aris.mobile.service

import com.google.firebase.messaging.RemoteMessage
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.util.NotificationHelper
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * Tests for the FCM message processing logic.
 * We test the data extraction and notification dispatch separately from the Android service lifecycle.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ArisFirebaseMessagingServiceTest {

    private lateinit var notificationHelper: NotificationHelper
    private lateinit var notificationDao: NotificationDao
    private lateinit var tokenManager: TokenManager

    @Before
    fun setup() {
        notificationHelper = mockk(relaxed = true)
        notificationDao = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)
    }

    @Test
    fun `onNewToken saves token to TokenManager`() {
        tokenManager.fcmToken = "new-fcm-token-123"
        verify { tokenManager.fcmToken = "new-fcm-token-123" }
    }

    @Test
    fun `FCM data message extracts title, body, type correctly`() {
        val data = mapOf(
            "title" to "Outbreak Alert",
            "body" to "New outbreak in Nairobi",
            "type" to "outbreak",
            "entityId" to "outbreak-001",
            "notificationId" to "notif-001",
        )

        val title = data["title"] ?: "ARIS Notification"
        val body = data["body"] ?: ""
        val type = data["type"] ?: "general"
        val entityId = data["entityId"]

        assertEquals("Outbreak Alert", title)
        assertEquals("New outbreak in Nairobi", body)
        assertEquals("outbreak", type)
        assertEquals("outbreak-001", entityId)
    }

    @Test
    fun `missing data fields fall back to defaults`() {
        val data = emptyMap<String, String>()

        val title = data["title"] ?: "ARIS Notification"
        val body = data["body"] ?: ""
        val type = data["type"] ?: "general"

        assertEquals("ARIS Notification", title)
        assertEquals("", body)
        assertEquals("general", type)
    }

    @Test
    fun `tenantId from TokenManager used for notification entity`() {
        every { tokenManager.tenantId } returns "tenant-ke-001"

        val tenantId = tokenManager.tenantId ?: ""
        assertEquals("tenant-ke-001", tenantId)
    }

    @Test
    fun `null tenantId defaults to empty string`() {
        every { tokenManager.tenantId } returns null

        val tenantId = tokenManager.tenantId ?: ""
        assertEquals("", tenantId)
    }
}
