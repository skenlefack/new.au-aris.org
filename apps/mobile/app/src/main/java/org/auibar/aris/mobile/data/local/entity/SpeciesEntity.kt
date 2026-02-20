package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "species")
data class SpeciesEntity(
    @PrimaryKey val id: String,
    val commonName: String,
    val scientificName: String,
    val category: String,
    val syncedAt: Long
)
