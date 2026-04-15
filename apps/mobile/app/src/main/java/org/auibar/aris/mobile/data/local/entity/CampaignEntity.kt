package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "campaigns",
    indices = [
        Index("status"),
        Index("tenantId"),
        Index("domain"),
    ],
)
data class CampaignEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val name: String,
    val domain: String,
    val templateId: String,
    val startDate: Long,
    val endDate: Long,
    val status: String,
    val description: String? = null,
    val targetSubmissions: Int? = null,
    val totalSubmissions: Int = 0,
    val validatedSubmissions: Int = 0,
    val rejectedSubmissions: Int = 0,
    val syncedAt: Long? = null,
)
