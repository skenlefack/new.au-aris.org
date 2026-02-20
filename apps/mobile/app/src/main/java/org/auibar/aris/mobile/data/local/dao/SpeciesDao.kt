package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity

@Dao
interface SpeciesDao {
    @Query("SELECT * FROM species ORDER BY commonName ASC")
    suspend fun getAll(): List<SpeciesEntity>

    @Query("SELECT * FROM species WHERE category = :category ORDER BY commonName ASC")
    suspend fun getByCategory(category: String): List<SpeciesEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(species: List<SpeciesEntity>)

    @Query("DELETE FROM species")
    suspend fun deleteAll()
}
