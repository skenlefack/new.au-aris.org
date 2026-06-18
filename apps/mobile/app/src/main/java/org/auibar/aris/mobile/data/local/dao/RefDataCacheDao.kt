package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import org.auibar.aris.mobile.data.local.entity.RefDataCacheEntity

@Dao
interface RefDataCacheDao {
    @Query("SELECT * FROM ref_data_cache WHERE type = :type ORDER BY sortOrder ASC, label ASC")
    suspend fun getByType(type: String): List<RefDataCacheEntity>

    @Query("SELECT * FROM ref_data_cache WHERE type = :type AND parentId = :parentId ORDER BY sortOrder ASC, label ASC")
    suspend fun getByTypeAndParent(type: String, parentId: String): List<RefDataCacheEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<RefDataCacheEntity>)

    @Query("DELETE FROM ref_data_cache WHERE type = :type")
    suspend fun deleteByType(type: String)

    @Query("SELECT COUNT(*) FROM ref_data_cache WHERE type = :type")
    suspend fun countByType(type: String): Int
}
