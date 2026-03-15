package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.MessageEntity

@Dao
interface MessageDao {

    @Query("SELECT * FROM messages WHERE threadId = :threadId ORDER BY createdAt ASC")
    fun getByThread(threadId: String): Flow<List<MessageEntity>>

    @Query("""
        SELECT * FROM messages m1
        WHERE m1.createdAt = (
            SELECT MAX(m2.createdAt) FROM messages m2 WHERE m2.threadId = m1.threadId
        )
        GROUP BY m1.threadId
        ORDER BY m1.createdAt DESC
    """)
    fun getThreadPreviews(): Flow<List<MessageEntity>>

    @Query("SELECT COUNT(*) FROM messages WHERE isRead = 0 AND isOutgoing = 0")
    fun getUnreadCount(): Flow<Int>

    @Query("UPDATE messages SET isRead = 1 WHERE threadId = :threadId AND isRead = 0")
    suspend fun markThreadRead(threadId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(message: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(messages: List<MessageEntity>)

    @Query("SELECT * FROM messages WHERE syncStatus = 'PENDING'")
    suspend fun getPending(): List<MessageEntity>

    @Query("UPDATE messages SET syncStatus = :status WHERE id = :id")
    suspend fun updateSyncStatus(id: String, status: String)

    @Query("DELETE FROM messages")
    suspend fun deleteAll()
}
