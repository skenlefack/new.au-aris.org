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

    @Query("SELECT * FROM submissions WHERE syncStatus = 'CONFLICT' ORDER BY offlineCreatedAt DESC")
    fun getConflicts(): Flow<List<SubmissionEntity>>

    @Query("SELECT COUNT(*) FROM submissions WHERE syncStatus = 'CONFLICT'")
    fun getConflictCount(): Flow<Int>

    @Query("UPDATE submissions SET syncStatus = 'CONFLICT', serverData = :serverData WHERE id = :id")
    suspend fun markConflict(id: String, serverData: String)

    @Query("UPDATE submissions SET data = :resolvedData, serverData = null, syncStatus = 'PENDING', serverErrors = null WHERE id = :id")
    suspend fun resolveConflict(id: String, resolvedData: String)

    @Query("DELETE FROM submissions WHERE id = :id")
    suspend fun delete(id: String)

    @Query("UPDATE submissions SET workflowLevel = :level, workflowStatus = :status WHERE id = :id")
    suspend fun updateWorkflow(id: String, level: Int, status: String)

    @Query("UPDATE submissions SET qualityGateResults = :results WHERE id = :id")
    suspend fun updateQualityResults(id: String, results: String)

    @Query("UPDATE submissions SET domain = :domain WHERE id = :id AND domain IS NULL")
    suspend fun setDomain(id: String, domain: String)

    @Query("SELECT COUNT(*) FROM submissions WHERE syncStatus = :status")
    suspend fun getCountByStatus(status: String): Int

    @Query("SELECT COUNT(*) FROM submissions")
    suspend fun getTotalCount(): Int

    @Query("SELECT domain, COUNT(*) as cnt FROM submissions WHERE domain IS NOT NULL GROUP BY domain")
    suspend fun getCountByDomain(): List<DomainCount>
}

data class DomainCount(
    val domain: String?,
    val cnt: Int,
)
