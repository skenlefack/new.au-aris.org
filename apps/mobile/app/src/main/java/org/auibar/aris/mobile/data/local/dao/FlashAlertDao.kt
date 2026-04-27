package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity

@Dao
interface FlashAlertDao {
    @Query("SELECT * FROM flash_alerts ORDER BY detectedAt DESC")
    fun observeAll(): Flow<List<FlashAlertEntity>>

    @Query("SELECT * FROM flash_alerts WHERE isRead = 0 ORDER BY detectedAt DESC")
    fun observeUnread(): Flow<List<FlashAlertEntity>>

    @Query("SELECT COUNT(*) FROM flash_alerts WHERE isRead = 0")
    fun observeUnreadCount(): Flow<Int>

    @Query("SELECT * FROM flash_alerts WHERE id = :id")
    suspend fun getById(id: String): FlashAlertEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(alert: FlashAlertEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(alerts: List<FlashAlertEntity>)

    @Query("UPDATE flash_alerts SET isRead = 1 WHERE id = :id")
    suspend fun markAsRead(id: String)

    @Query("UPDATE flash_alerts SET isRead = 1")
    suspend fun markAllAsRead()

    @Query("DELETE FROM flash_alerts WHERE syncedAt < :cutoff")
    suspend fun deleteOlderThan(cutoff: Long)
}
