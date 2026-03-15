package org.auibar.aris.mobile.data.repository

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.local.dao.MessageDao
import org.auibar.aris.mobile.data.local.entity.MessageEntity
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

@Serializable
data class SendMessageRequest(
    val recipientId: String,
    val body: String,
)

@Serializable
data class MessageDto(
    val id: String,
    val threadId: String,
    val senderId: String,
    val senderName: String,
    val recipientId: String,
    val recipientName: String,
    val body: String,
    val createdAt: Long,
)

class MessageRepository @Inject constructor(
    private val messageDao: MessageDao,
    private val client: HttpClient,
    private val tokenManager: TokenManager,
) {
    fun getThreadPreviews(): Flow<List<MessageEntity>> = messageDao.getThreadPreviews()

    fun getThread(threadId: String): Flow<List<MessageEntity>> = messageDao.getByThread(threadId)

    fun getUnreadCount(): Flow<Int> = messageDao.getUnreadCount()

    suspend fun markThreadRead(threadId: String) = messageDao.markThreadRead(threadId)

    suspend fun sendMessage(recipientId: String, recipientName: String, body: String) {
        val userId = tokenManager.userId ?: return
        val userName = tokenManager.userFullName ?: "Me"

        // Generate a thread ID based on participants (deterministic)
        val participants = listOf(userId, recipientId).sorted()
        val threadId = "thread_${participants.joinToString("_")}"

        val messageId = UUID.randomUUID().toString()
        val entity = MessageEntity(
            id = messageId,
            threadId = threadId,
            senderId = userId,
            senderName = userName,
            recipientId = recipientId,
            recipientName = recipientName,
            body = body,
            isRead = true,
            isOutgoing = true,
            createdAt = System.currentTimeMillis(),
            syncStatus = "PENDING",
        )
        messageDao.upsert(entity)

        // Try to send immediately
        try {
            client.post("/api/v1/message/direct") {
                contentType(ContentType.Application.Json)
                setBody(SendMessageRequest(recipientId = recipientId, body = body))
            }
            messageDao.updateSyncStatus(messageId, "SYNCED")
        } catch (_: Exception) {
            // Will be synced later
        }
    }

    suspend fun fetchMessages() {
        try {
            val response: ApiResponse<List<MessageDto>> = client.get("/api/v1/message/direct") {
                parameter("limit", 100)
            }.body()

            val userId = tokenManager.userId ?: return
            val messages = response.data?.map { dto ->
                MessageEntity(
                    id = dto.id,
                    threadId = dto.threadId,
                    senderId = dto.senderId,
                    senderName = dto.senderName,
                    recipientId = dto.recipientId,
                    recipientName = dto.recipientName,
                    body = dto.body,
                    isOutgoing = dto.senderId == userId,
                    createdAt = dto.createdAt,
                    syncStatus = "SYNCED",
                )
            } ?: return

            messageDao.upsertAll(messages)
        } catch (_: Exception) {
            // Offline — use cached messages
        }
    }

    suspend fun syncPending() {
        val pending = messageDao.getPending()
        for (msg in pending) {
            try {
                client.post("/api/v1/message/direct") {
                    contentType(ContentType.Application.Json)
                    setBody(SendMessageRequest(recipientId = msg.recipientId, body = msg.body))
                }
                messageDao.updateSyncStatus(msg.id, "SYNCED")
            } catch (_: Exception) {
                // Keep as PENDING, will retry
            }
        }
    }
}
