package org.auibar.aris.mobile.data.repository

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.data.remote.api.MessageApi
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.remote.dto.NotificationDto
import org.auibar.aris.mobile.data.remote.websocket.RealtimeEvent
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationRepositoryTest {

    private val notificationDao: NotificationDao = mockk(relaxed = true)
    private val messageApi: MessageApi = mockk(relaxed = true)
    private val tokenManager: TokenManager = mockk(relaxed = true)

    private lateinit var repository: NotificationRepository

    @Before
    fun setup() {
        every { tokenManager.tenantId } returns "tenant-ke"
        repository = NotificationRepository(notificationDao, messageApi, tokenManager)
    }

    @Test
    fun `getAll returns mapped notifications from DAO`() = runTest {
        val entities = listOf(
            NotificationEntity(
                id = "n-1",
                tenantId = "tenant-ke",
                title = "Outbreak Alert",
                body = "FMD outbreak in Nairobi",
                type = "outbreak_alert",
                isRead = false,
                createdAt = 1000L,
            ),
            NotificationEntity(
                id = "n-2",
                tenantId = "tenant-ke",
                title = "Sync complete",
                body = "Data synchronized",
                type = "notification",
                isRead = true,
                createdAt = 2000L,
                readAt = 2500L,
            ),
        )
        every { notificationDao.getAll() } returns flowOf(entities)

        val notifications = repository.getAll().first()

        assertEquals(2, notifications.size)
        assertEquals("n-1", notifications[0].id)
        assertEquals("Outbreak Alert", notifications[0].title)
        assertEquals(false, notifications[0].isRead)
        assertEquals(true, notifications[1].isRead)
    }

    @Test
    fun `getUnreadCount delegates to DAO`() = runTest {
        every { notificationDao.getUnreadCount() } returns flowOf(5)

        val count = repository.getUnreadCount().first()

        assertEquals(5, count)
    }

    @Test
    fun `markAsRead calls DAO and API`() = runTest {
        coEvery { messageApi.markAsRead("n-1") } returns ApiResponse(
            data = NotificationDto(
                id = "n-1", tenantId = "tenant-ke", recipientId = "user-1",
                type = "notification", channel = "push",
                title = "Test", body = "Test", isRead = true,
                readAt = "2024-01-01T00:00:00Z", createdAt = "2024-01-01T00:00:00Z",
            )
        )

        repository.markAsRead("n-1")

        coVerify { notificationDao.markAsRead("n-1", any()) }
        coVerify { messageApi.markAsRead("n-1") }
    }

    @Test
    fun `markAsRead does not throw when API fails`() = runTest {
        coEvery { messageApi.markAsRead("n-1") } throws RuntimeException("Network error")

        // Should not throw — local state updated, server sync is best-effort
        repository.markAsRead("n-1")

        coVerify { notificationDao.markAsRead("n-1", any()) }
    }

    @Test
    fun `refresh fetches from API and inserts into DAO`() = runTest {
        val dtos = listOf(
            NotificationDto(
                id = "n-1", tenantId = "tenant-ke", recipientId = "user-1",
                type = "outbreak_alert", channel = "push",
                title = "FMD Alert", body = "New outbreak",
                isRead = false, createdAt = "2024-06-15T10:00:00Z",
            ),
        )
        coEvery { messageApi.getNotifications(any(), any()) } returns ApiResponse(data = dtos)

        val result = repository.refresh()

        assertTrue(result.isSuccess)
        coVerify { notificationDao.insertAll(match { it.size == 1 && it[0].id == "n-1" }) }
    }

    @Test
    fun `refresh returns failure on API error`() = runTest {
        coEvery { messageApi.getNotifications(any(), any()) } throws RuntimeException("Server error")

        val result = repository.refresh()

        assertTrue(result.isFailure)
    }

    @Test
    fun `insertFromEvent creates entity from realtime event`() = runTest {
        val event = RealtimeEvent(
            type = "outbreak_alert",
            title = "FMD Alert",
            body = "Outbreak detected in Mombasa",
            payload = mapOf("id" to "ev-1"),
        )

        repository.insertFromEvent(event)

        coVerify {
            notificationDao.insert(match {
                it.id == "ev-1" &&
                it.title == "FMD Alert" &&
                it.type == "outbreak_alert" &&
                !it.isRead
            })
        }
    }

    @Test
    fun `insertFromEvent generates UUID when payload has no id`() = runTest {
        val event = RealtimeEvent(
            type = "notification",
            title = "Sync",
            body = "Sync complete",
            payload = emptyMap(),
        )

        repository.insertFromEvent(event)

        coVerify {
            notificationDao.insert(match {
                it.id.isNotEmpty() && it.title == "Sync"
            })
        }
    }

    @Test
    fun `clearAll delegates to DAO`() = runTest {
        repository.clearAll()

        coVerify { notificationDao.deleteAll() }
    }
}
