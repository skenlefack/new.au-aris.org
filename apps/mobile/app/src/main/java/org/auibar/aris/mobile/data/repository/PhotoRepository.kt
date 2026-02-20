package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.local.entity.PhotoEntity
import java.util.UUID
import javax.inject.Inject

data class Photo(
    val id: String,
    val submissionId: String,
    val filePath: String,
    val thumbnailPath: String?,
    val originalSizeBytes: Long,
    val compressedSizeBytes: Long?,
    val gpsLat: Double?,
    val gpsLng: Double?,
    val capturedAt: Long,
    val uploadStatus: String,
    val serverUrl: String?,
    val errorMessage: String?,
)

class PhotoRepository @Inject constructor(
    private val photoDao: PhotoDao,
) {
    fun getBySubmission(submissionId: String): Flow<List<Photo>> {
        return photoDao.getBySubmission(submissionId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getCountBySubmission(submissionId: String): Flow<Int> =
        photoDao.getCountBySubmission(submissionId)

    suspend fun addPhoto(
        submissionId: String,
        filePath: String,
        thumbnailPath: String?,
        originalSizeBytes: Long,
        compressedSizeBytes: Long?,
        gpsLat: Double?,
        gpsLng: Double?,
    ): String {
        val id = UUID.randomUUID().toString()
        val entity = PhotoEntity(
            id = id,
            submissionId = submissionId,
            filePath = filePath,
            thumbnailPath = thumbnailPath,
            originalSizeBytes = originalSizeBytes,
            compressedSizeBytes = compressedSizeBytes,
            gpsLat = gpsLat,
            gpsLng = gpsLng,
            capturedAt = System.currentTimeMillis(),
            uploadStatus = "PENDING",
            serverUrl = null,
            errorMessage = null,
        )
        photoDao.insert(entity)
        return id
    }

    suspend fun getPendingUpload(): List<Photo> =
        photoDao.getPendingUpload().map { it.toDomain() }

    suspend fun markUploaded(id: String, serverUrl: String) {
        photoDao.updateUploadStatus(id, "UPLOADED", serverUrl)
    }

    suspend fun markFailed(id: String, error: String) {
        photoDao.updateUploadError(id, "FAILED", error)
    }

    suspend fun deletePhoto(id: String) {
        photoDao.deleteById(id)
    }

    private fun PhotoEntity.toDomain() = Photo(
        id = id,
        submissionId = submissionId,
        filePath = filePath,
        thumbnailPath = thumbnailPath,
        originalSizeBytes = originalSizeBytes,
        compressedSizeBytes = compressedSizeBytes,
        gpsLat = gpsLat,
        gpsLng = gpsLng,
        capturedAt = capturedAt,
        uploadStatus = uploadStatus,
        serverUrl = serverUrl,
        errorMessage = errorMessage,
    )
}
