package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notifications")
data class NotificationEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val title: String,
    val body: String,
    val type: String,         // outbreak_alert | notification | sync_update
    val isRead: Boolean = false,
    val createdAt: Long,
    val readAt: Long? = null,
)
