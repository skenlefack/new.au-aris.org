package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "submissions",
    indices = [
        Index("campaignId"),
        Index("syncStatus"),
        Index("tenantId"),
        Index("offlineCreatedAt"),
    ],
)
data class SubmissionEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val campaignId: String,
    val templateId: String,
    val data: String,
    val gpsLat: Double?,
    val gpsLng: Double?,
    val gpsAccuracy: Float?,
    val offlineCreatedAt: Long,
    val syncedAt: Long?,
    val syncStatus: String,
    val serverErrors: String?,
    val serverData: String? = null,
    val workflowLevel: Int = 0,
    val workflowStatus: String? = null,
    val qualityGateResults: String? = null,
    val domain: String? = null,
)
