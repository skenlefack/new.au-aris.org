package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "submissions")
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
    val serverErrors: String?
)
