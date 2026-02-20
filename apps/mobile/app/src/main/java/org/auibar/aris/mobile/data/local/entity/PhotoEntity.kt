package org.auibar.aris.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "photos",
    indices = [
        Index("submissionId"),
        Index("uploadStatus"),
    ],
)
data class PhotoEntity(
    @PrimaryKey val id: String,
    val submissionId: String,
    val filePath: String,
    val thumbnailPath: String?,
    val originalSizeBytes: Long,
    val compressedSizeBytes: Long?,
    val gpsLat: Double?,
    val gpsLng: Double?,
    val capturedAt: Long,
    val uploadStatus: String,  // PENDING, UPLOADING, UPLOADED, FAILED
    val serverUrl: String?,
    val errorMessage: String?,
)
