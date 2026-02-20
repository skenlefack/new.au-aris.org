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
    val syncedAt: Long?
)
