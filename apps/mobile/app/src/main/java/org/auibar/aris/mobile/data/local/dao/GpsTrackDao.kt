package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.GpsTrackEntity

@Dao
interface GpsTrackDao {
    @Query("SELECT * FROM gps_tracks ORDER BY startedAt DESC")
    fun getAll(): Flow<List<GpsTrackEntity>>

    @Query("SELECT * FROM gps_tracks WHERE submissionId = :submissionId")
    fun getBySubmission(submissionId: String): Flow<List<GpsTrackEntity>>

    @Query("SELECT * FROM gps_tracks WHERE status = 'RECORDING' LIMIT 1")
    suspend fun getActiveTrack(): GpsTrackEntity?

    @Query("SELECT * FROM gps_tracks WHERE status = 'RECORDING' LIMIT 1")
    fun observeActiveTrack(): Flow<GpsTrackEntity?>

    @Query("SELECT * FROM gps_tracks WHERE id = :id")
    suspend fun getById(id: String): GpsTrackEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(track: GpsTrackEntity)

    @Query("UPDATE gps_tracks SET geoJson = :geoJson, pointCount = :pointCount, distanceMeters = :distance WHERE id = :id")
    suspend fun updateTrackData(id: String, geoJson: String, pointCount: Int, distance: Double)

    @Query("UPDATE gps_tracks SET status = :status, stoppedAt = :stoppedAt WHERE id = :id")
    suspend fun stopTrack(id: String, status: String, stoppedAt: Long)

    @Query("UPDATE gps_tracks SET submissionId = :submissionId, status = 'ATTACHED' WHERE id = :id")
    suspend fun attachToSubmission(id: String, submissionId: String)

    @Query("DELETE FROM gps_tracks WHERE id = :id")
    suspend fun deleteById(id: String)
}
