package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import org.auibar.aris.mobile.data.local.entity.GeoEntity

@Dao
interface GeoDao {
    @Query("SELECT * FROM geo_units WHERE level = :level ORDER BY name ASC")
    suspend fun getByLevel(level: String): List<GeoEntity>

    @Query("SELECT * FROM geo_units WHERE parentId = :parentId ORDER BY name ASC")
    suspend fun getChildren(parentId: String): List<GeoEntity>

    @Query("SELECT * FROM geo_units WHERE id = :id")
    suspend fun getById(id: String): GeoEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(geoUnits: List<GeoEntity>)

    @Query("DELETE FROM geo_units")
    suspend fun deleteAll()
}
