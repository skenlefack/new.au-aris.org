package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "messages",
    indices = [
        Index("threadId"),
        Index("isRead"),
        Index("createdAt"),
    ],
)
data class MessageEntity(
    @PrimaryKey val id: String,
    val threadId: String,
    val senderId: String,
    val senderName: String,
    val recipientId: String,
    val recipientName: String,
    val body: String,
    val isRead: Boolean = false,
    val isOutgoing: Boolean = false,
    val createdAt: Long,
    val syncStatus: String = "SYNCED", // SYNCED, PENDING, FAILED
)
