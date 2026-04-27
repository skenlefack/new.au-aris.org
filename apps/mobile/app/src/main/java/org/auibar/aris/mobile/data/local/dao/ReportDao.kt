package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.ReportEntity

@Dao
interface ReportDao {
    @Query("SELECT * FROM reports WHERE status = 'PUBLISHED' ORDER BY publishedAt DESC")
    fun observePublished(): Flow<List<ReportEntity>>

    @Query("SELECT * FROM reports WHERE domainCode = :domainCode AND status = 'PUBLISHED' ORDER BY publishedAt DESC")
    fun observeByDomain(domainCode: String): Flow<List<ReportEntity>>

    @Query("SELECT * FROM reports WHERE id = :id")
    fun observeById(id: String): Flow<ReportEntity?>

    @Query("SELECT * FROM reports WHERE id = :id")
    suspend fun getById(id: String): ReportEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(reports: List<ReportEntity>)

    @Query("UPDATE reports SET pdfDownloadStatus = :status, pdfLocalPath = :path WHERE id = :id")
    suspend fun updateDownloadStatus(id: String, status: String, path: String?)

    @Query("UPDATE reports SET pdfDownloadStatus = 'NOT_DOWNLOADED', pdfLocalPath = NULL WHERE pdfDownloadStatus = 'DOWNLOADING'")
    suspend fun resetStuckDownloads()
}
