package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.CampaignEntity

@Dao
interface CampaignDao {
    @Query("SELECT * FROM campaigns ORDER BY startDate DESC")
    fun getAll(): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE status = 'ACTIVE' ORDER BY startDate DESC")
    fun getActiveCampaigns(): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE id = :id")
    suspend fun getById(id: String): CampaignEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(campaigns: List<CampaignEntity>)

    @Query("SELECT * FROM campaigns WHERE id = :id")
    fun observeById(id: String): Flow<CampaignEntity?>

    @Query("SELECT * FROM campaigns WHERE status = 'ACTIVE' AND LOWER(domain) LIKE '%' || LOWER(:domain) || '%' ORDER BY startDate DESC")
    fun getActiveCampaignsByDomain(domain: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE status = 'ACTIVE' AND domain IN (:domains) ORDER BY startDate DESC")
    fun getActiveCampaignsByDomains(domains: List<String>): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE LOWER(domain) LIKE '%' || LOWER(:domain) || '%' ORDER BY startDate DESC")
    fun getAllCampaignsByDomain(domain: String): Flow<List<CampaignEntity>>

    @Query("DELETE FROM campaigns")
    suspend fun deleteAll()
}
