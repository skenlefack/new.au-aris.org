package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.KpiSnapshotEntity

@Dao
interface KpiSnapshotDao {
    @Query("SELECT * FROM kpi_snapshots WHERE id = :id")
    suspend fun getById(id: String): KpiSnapshotEntity?

    @Query("SELECT * FROM kpi_snapshots WHERE id = :id")
    fun observeById(id: String): Flow<KpiSnapshotEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: KpiSnapshotEntity)

    @Query("DELETE FROM kpi_snapshots")
    suspend fun deleteAll()
}
