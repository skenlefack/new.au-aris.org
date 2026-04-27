package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "indicator_values",
    foreignKeys = [
        ForeignKey(
            entity = IndicatorEntity::class,
            parentColumns = ["id"],
            childColumns = ["indicatorId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("indicatorId"),
        Index("year"),
    ],
)
data class IndicatorValueEntity(
    @PrimaryKey val id: String,
    val indicatorId: String,
    val year: Int,
    val month: Int? = null,
    val quarter: Int? = null,
    val countryCode: String? = null,
    val recCode: String? = null,
    @ColumnInfo(defaultValue = "0") val isContinental: Boolean = false,
    val value: Double,
    val source: String? = null,
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
