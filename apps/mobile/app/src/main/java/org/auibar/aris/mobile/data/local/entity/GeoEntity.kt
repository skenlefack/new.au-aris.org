package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "geo_units")
data class GeoEntity(
    @PrimaryKey val id: String,
    val name: String,
    val level: String,
    val parentId: String?,
    val isoCode: String?,
    val syncedAt: Long
)
