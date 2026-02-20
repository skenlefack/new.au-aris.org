package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class NotificationDto(
    val id: String,
    val tenantId: String,
    val recipientId: String,
    val type: String,          // outbreak_alert | notification | sync_update
    val channel: String,       // push | in_app | email | sms
    val title: String,
    val body: String,
    val isRead: Boolean = false,
    val readAt: String? = null,
    val createdAt: String,
)
