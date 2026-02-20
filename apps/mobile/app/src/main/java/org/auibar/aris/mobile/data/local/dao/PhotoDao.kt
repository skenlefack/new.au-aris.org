package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.PhotoEntity

@Dao
interface PhotoDao {
    @Query("SELECT * FROM photos WHERE submissionId = :submissionId ORDER BY capturedAt DESC")
    fun getBySubmission(submissionId: String): Flow<List<PhotoEntity>>

    @Query("SELECT * FROM photos WHERE uploadStatus = 'PENDING' OR uploadStatus = 'FAILED'")
    suspend fun getPendingUpload(): List<PhotoEntity>

    @Query("SELECT COUNT(*) FROM photos WHERE submissionId = :submissionId")
    fun getCountBySubmission(submissionId: String): Flow<Int>

    @Query("SELECT * FROM photos WHERE id = :id")
    suspend fun getById(id: String): PhotoEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(photo: PhotoEntity)

    @Query("UPDATE photos SET uploadStatus = :status, serverUrl = :serverUrl WHERE id = :id")
    suspend fun updateUploadStatus(id: String, status: String, serverUrl: String?)

    @Query("UPDATE photos SET uploadStatus = :status, errorMessage = :error WHERE id = :id")
    suspend fun updateUploadError(id: String, status: String, error: String?)

    @Query("DELETE FROM photos WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM photos WHERE submissionId = :submissionId")
    suspend fun deleteBySubmission(submissionId: String)
}
