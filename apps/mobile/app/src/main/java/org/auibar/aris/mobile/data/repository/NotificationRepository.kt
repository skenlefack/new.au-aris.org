package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.data.remote.api.MessageApi
import org.auibar.aris.mobile.data.remote.websocket.RealtimeEvent
import org.auibar.aris.mobile.util.TokenManager
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

data class Notification(
    val id: String,
    val title: String,
    val body: String,
    val type: String,
    val isRead: Boolean,
    val createdAt: Long,
)

class NotificationRepository @Inject constructor(
    private val notificationDao: NotificationDao,
    private val messageApi: MessageApi,
    private val tokenManager: TokenManager,
) {

    fun getAll(): Flow<List<Notification>> =
        notificationDao.getAll().map { list ->
            list.map { it.toDomain() }
        }

    fun getUnreadCount(): Flow<Int> = notificationDao.getUnreadCount()

    suspend fun markAsRead(id: String) {
        notificationDao.markAsRead(id)
        try {
            messageApi.markAsRead(id)
        } catch (_: Exception) {
            // Best-effort server sync; local state is already updated
        }
    }

    suspend fun markAllAsRead() {
        notificationDao.markAllAsRead()
    }

    /**
     * Fetch notifications from the message service and store in Room.
     */
    suspend fun refresh(): Result<Unit> {
        return try {
            val response = messageApi.getNotifications(page = 1, limit = 50)
            val entities = response.data.map { dto ->
                NotificationEntity(
                    id = dto.id,
                    tenantId = dto.tenantId,
                    title = dto.title,
                    body = dto.body,
                    type = dto.type,
                    isRead = dto.isRead,
                    createdAt = parseTimestamp(dto.createdAt),
                    readAt = dto.readAt?.let { parseTimestamp(it) },
                )
            }
            notificationDao.insertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Insert a real-time event received via WebSocket into the local DB.
     */
    suspend fun insertFromEvent(event: RealtimeEvent) {
        val entity = NotificationEntity(
            id = event.payload["id"] ?: UUID.randomUUID().toString(),
            tenantId = tokenManager.tenantId ?: "",
            title = event.title,
            body = event.body,
            type = event.type,
            isRead = false,
            createdAt = System.currentTimeMillis(),
        )
        notificationDao.insert(entity)
    }

    suspend fun clearAll() {
        notificationDao.deleteAll()
    }

    private fun parseTimestamp(iso: String): Long {
        return try {
            Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) {
            System.currentTimeMillis()
        }
    }

    private fun NotificationEntity.toDomain() = Notification(
        id = id,
        title = title,
        body = body,
        type = type,
        isRead = isRead,
        createdAt = createdAt,
    )
}
