package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.local.entity.IndicatorValueEntity

@Dao
interface IndicatorDao {
    @Query("SELECT * FROM indicators WHERE active = 1 ORDER BY nameFr")
    fun observeAll(): Flow<List<IndicatorEntity>>

    @Query("SELECT * FROM indicators WHERE domainCode = :domainCode AND active = 1 ORDER BY nameFr")
    fun observeByDomain(domainCode: String): Flow<List<IndicatorEntity>>

    @Query("SELECT * FROM indicators WHERE id = :id")
    fun observeById(id: String): Flow<IndicatorEntity?>

    @Query("SELECT * FROM indicators WHERE id = :id")
    suspend fun getById(id: String): IndicatorEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(indicators: List<IndicatorEntity>)

    @Query("DELETE FROM indicators WHERE syncedAt < :cutoff")
    suspend fun deleteOlderThan(cutoff: Long)

    @Query("SELECT COUNT(*) FROM indicators WHERE active = 1")
    fun observeCount(): Flow<Int>
}

@Dao
interface IndicatorValueDao {
    @Query("""
        SELECT * FROM indicator_values
        WHERE indicatorId = :indicatorId
        ORDER BY year DESC, month DESC, quarter DESC
        LIMIT :limit
    """)
    fun observeRecent(indicatorId: String, limit: Int = 24): Flow<List<IndicatorValueEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(values: List<IndicatorValueEntity>)

    @Query("DELETE FROM indicator_values WHERE indicatorId = :indicatorId")
    suspend fun deleteForIndicator(indicatorId: String)
}
