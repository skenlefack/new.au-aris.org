package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import javax.inject.Inject

data class Campaign(
    val id: String,
    val tenantId: String,
    val name: String,
    val domain: String,
    val templateId: String,
    val startDate: Long,
    val endDate: Long,
    val status: String,
)

class CampaignRepository @Inject constructor(
    private val campaignDao: CampaignDao,
    private val campaignApi: CampaignApi,
) {
    fun getActiveCampaigns(): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaigns().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    suspend fun refreshCampaigns(): Result<Unit> {
        return try {
            val response = campaignApi.getActiveCampaigns()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                CampaignEntity(
                    id = dto.id,
                    tenantId = dto.tenantId,
                    name = dto.name,
                    domain = dto.domain,
                    templateId = dto.templateId,
                    startDate = dto.startDate,
                    endDate = dto.endDate,
                    status = dto.status,
                    syncedAt = now,
                )
            }
            campaignDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun CampaignEntity.toDomain() = Campaign(
        id = id,
        tenantId = tenantId,
        name = name,
        domain = domain,
        templateId = templateId,
        startDate = startDate,
        endDate = endDate,
        status = status,
    )
}
