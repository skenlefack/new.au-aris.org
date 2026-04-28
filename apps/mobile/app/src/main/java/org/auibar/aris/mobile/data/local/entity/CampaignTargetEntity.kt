package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "campaign_targets",
    foreignKeys = [
        ForeignKey(
            entity = CampaignEntity::class,
            parentColumns = ["id"],
            childColumns = ["campaignId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("campaignId"),
        Index("domainCode"),
        Index("subDomainCode"),
    ],
)
data class CampaignTargetEntity(
    @PrimaryKey val id: String,
    val campaignId: String,
    val domainCode: String,
    val subDomainCode: String?,
    @ColumnInfo(defaultValue = "0") val isPrimary: Boolean = false,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
