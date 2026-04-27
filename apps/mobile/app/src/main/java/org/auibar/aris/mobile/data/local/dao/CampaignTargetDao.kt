package org.auibar.aris.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.CampaignTargetEntity

@Dao
interface CampaignTargetDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(targets: List<CampaignTargetEntity>)

    @Query("DELETE FROM campaign_targets WHERE campaignId = :campaignId")
    suspend fun deleteForCampaign(campaignId: String)

    @Transaction
    suspend fun replaceForCampaign(campaignId: String, targets: List<CampaignTargetEntity>) {
        deleteForCampaign(campaignId)
        upsertAll(targets)
    }

    @Query("SELECT * FROM campaign_targets WHERE campaignId = :campaignId")
    fun observeForCampaign(campaignId: String): Flow<List<CampaignTargetEntity>>

    @Query("SELECT * FROM campaign_targets WHERE campaignId = :campaignId")
    suspend fun getForCampaign(campaignId: String): List<CampaignTargetEntity>

    @Query("""
        SELECT DISTINCT c.* FROM campaigns c
        INNER JOIN campaign_targets ct ON ct.campaignId = c.id
        WHERE ct.domainCode = :domainCode
          AND c.status = :status
        ORDER BY c.startDate DESC
    """)
    fun observeCampaignsByTarget(
        domainCode: String,
        status: String = "ACTIVE",
    ): Flow<List<CampaignEntity>>

    @Query("""
        SELECT DISTINCT c.* FROM campaigns c
        INNER JOIN campaign_targets ct ON ct.campaignId = c.id
        WHERE ct.domainCode = :domainCode
          AND ct.subDomainCode = :subDomainCode
          AND c.status = :status
        ORDER BY c.startDate DESC
    """)
    fun observeCampaignsByTargetAndSub(
        domainCode: String,
        subDomainCode: String,
        status: String = "ACTIVE",
    ): Flow<List<CampaignEntity>>
}
