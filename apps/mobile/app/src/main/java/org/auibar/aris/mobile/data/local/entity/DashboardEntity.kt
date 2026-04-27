package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "dashboards",
    indices = [
        Index("scope"),
        Index("domainCode"),
        Index("ownerUserId"),
    ],
)
data class DashboardEntity(
    @PrimaryKey val id: String,
    val ownership: String,
    val scope: String,
    val domainCode: String? = null,
    val subDomainCode: String? = null,
    val valueChainCode: String? = null,
    val recCode: String? = null,
    val countryCode: String? = null,
    val titleFr: String,
    val titleEn: String,
    val titleAr: String? = null,
    val titlePt: String? = null,
    val description: String? = null,
    @ColumnInfo(defaultValue = "12") val gridColumns: Int = 12,
    @ColumnInfo(defaultValue = "80") val rowHeight: Int = 80,
    val ownerUserId: String? = null,
    @ColumnInfo(defaultValue = "0") val isDefault: Boolean = false,
    val cachedSnapshot: String? = null,
    val cachedSnapshotAt: Long? = null,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
