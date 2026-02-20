package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity

@Dao
interface SubmissionDao {
    @Query("SELECT * FROM submissions WHERE campaignId = :campaignId ORDER BY offlineCreatedAt DESC")
    fun getByCampaign(campaignId: String): Flow<List<SubmissionEntity>>

    @Query("SELECT * FROM submissions ORDER BY offlineCreatedAt DESC")
    fun getAll(): Flow<List<SubmissionEntity>>

    @Query("SELECT * FROM submissions WHERE syncStatus = 'PENDING'")
    suspend fun getPendingSync(): List<SubmissionEntity>

    @Query("SELECT COUNT(*) FROM submissions WHERE syncStatus IN ('PENDING', 'DRAFT')")
    fun getPendingCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM submissions WHERE campaignId = :campaignId")
    fun getCountByCampaign(campaignId: String): Flow<Int>

    @Query("SELECT * FROM submissions WHERE id = :id")
    suspend fun getById(id: String): SubmissionEntity?

    @Query("SELECT * FROM submissions WHERE syncStatus = 'DRAFT'")
    suspend fun getDrafts(): List<SubmissionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(submission: SubmissionEntity)

    @Update
    suspend fun update(submission: SubmissionEntity)

    @Query("UPDATE submissions SET syncStatus = :status, syncedAt = :syncedAt WHERE id = :id")
    suspend fun updateSyncStatus(id: String, status: String, syncedAt: Long?)

    @Query("UPDATE submissions SET syncStatus = :status, serverErrors = :errors WHERE id = :id")
    suspend fun updateSyncError(id: String, status: String, errors: String?)
}
