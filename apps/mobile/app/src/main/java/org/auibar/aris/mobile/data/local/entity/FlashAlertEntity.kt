package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "flash_alerts",
    indices = [
        Index("severity"),
        Index("detectedAt"),
        Index("isRead"),
    ],
)
data class FlashAlertEntity(
    @PrimaryKey val id: String,
    val alertCode: String,
    val severity: String,
    val sourceType: String,
    val sourceId: String? = null,
    val countryCode: String? = null,
    val recCode: String? = null,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val titleFr: String,
    val titleEn: String,
    val detectedAt: Long,
    val triggerDataJson: String? = null,
    val status: String,
    val relatedReportId: String? = null,
    @ColumnInfo(defaultValue = "0") val isRead: Boolean = false,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
