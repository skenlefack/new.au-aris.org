package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "reports",
    indices = [
        Index("status"),
        Index("domainCode"),
        Index("publishedAt"),
    ],
)
data class ReportEntity(
    @PrimaryKey val id: String,
    val templateCode: String,
    val type: String,
    val status: String,
    val titleFr: String,
    val titleEn: String,
    val themeFr: String? = null,
    val themeEn: String? = null,
    val periodStart: Long,
    val periodEnd: Long,
    val referenceYear: Int? = null,
    val scope: String,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val countryCode: String? = null,
    val recCode: String? = null,
    val pdfLocalPath: String? = null,
    val pdfRemoteUrl: String? = null,
    val pdfSizeBytes: Long? = null,
    @ColumnInfo(defaultValue = "NOT_DOWNLOADED") val pdfDownloadStatus: String = "NOT_DOWNLOADED",
    val publishedAt: Long? = null,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
