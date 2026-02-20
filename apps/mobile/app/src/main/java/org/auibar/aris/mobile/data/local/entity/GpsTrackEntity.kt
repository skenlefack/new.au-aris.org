package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "gps_tracks",
    indices = [
        Index("submissionId"),
        Index("status"),
    ],
)
data class GpsTrackEntity(
    @PrimaryKey val id: String,
    val submissionId: String?,
    val campaignId: String?,
    val geoJson: String,  // GeoJSON LineString
    val pointCount: Int,
    val distanceMeters: Double,
    val startedAt: Long,
    val stoppedAt: Long?,
    val status: String,  // RECORDING, COMPLETED, ATTACHED
)
