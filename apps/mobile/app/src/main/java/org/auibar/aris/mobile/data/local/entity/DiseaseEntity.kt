package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "diseases")
data class DiseaseEntity(
    @PrimaryKey val id: String,
    val name: String,
    val woahCode: String?,
    val category: String,
    val isNotifiable: Boolean,
    val syncedAt: Long
)
