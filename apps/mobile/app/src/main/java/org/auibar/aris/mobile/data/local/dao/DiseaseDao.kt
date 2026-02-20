package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity

@Dao
interface DiseaseDao {
    @Query("SELECT * FROM diseases ORDER BY name ASC")
    suspend fun getAll(): List<DiseaseEntity>

    @Query("SELECT * FROM diseases WHERE isNotifiable = 1 ORDER BY name ASC")
    suspend fun getNotifiable(): List<DiseaseEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(diseases: List<DiseaseEntity>)

    @Query("DELETE FROM diseases")
    suspend fun deleteAll()
}
