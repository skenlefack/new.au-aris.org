package org.auibar.aris.mobile.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "dashboard_widgets",
    foreignKeys = [
        ForeignKey(
            entity = DashboardEntity::class,
            parentColumns = ["id"],
            childColumns = ["dashboardId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("dashboardId"),
    ],
)
data class DashboardWidgetEntity(
    @PrimaryKey val id: String,
    val dashboardId: String,
    val type: String,
    val dataSource: String,
    @ColumnInfo(defaultValue = "0") val gridX: Int = 0,
    @ColumnInfo(defaultValue = "0") val gridY: Int = 0,
    @ColumnInfo(defaultValue = "12") val gridW: Int = 12,
    @ColumnInfo(defaultValue = "2") val gridH: Int = 2,
    val titleFr: String,
    val titleEn: String,
    @ColumnInfo(defaultValue = "{}") val configJson: String = "{}",
    @ColumnInfo(defaultValue = "0") val syncedAt: Long = 0L,
)
