package org.auibar.aris.mobile.data.cache

import android.util.Log
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CampaignRefresher @Inject constructor(
    private val campaignApi: CampaignApi,
    private val campaignDao: CampaignDao,
    private val formTemplateDao: FormTemplateDao,
    private val cachePolicy: CachePolicy,
) {
    companion object {
        private const val TAG = "CampaignRefresher"
    }

    /** Refresh campaigns if stale. */
    suspend fun refreshIfNeeded() {
        if (cachePolicy.isStale(CachePolicy.KEY_CAMPAIGNS, cachePolicy.campaignsTtlMs)) {
            refreshCampaigns()
        }
    }

    /** Force refresh — called on pull-to-refresh. */
    suspend fun forceRefresh() {
        refreshCampaigns()
    }

    /** Refresh templates for a specific campaign. */
    suspend fun refreshTemplateForCampaign(templateId: String) {
        try {
            val response = campaignApi.getFormTemplate(templateId)
            val dto = response.data
            val now = System.currentTimeMillis()
            formTemplateDao.upsertAll(
                listOf(
                    FormTemplateEntity(
                        id = dto.id,
                        name = dto.name,
                        domain = dto.domain,
                        schema = dto.schema,
                        uiSchema = dto.uiSchema,
                        version = dto.version,
                        syncedAt = now,
                    )
                )
            )
            cachePolicy.markRefreshed(CachePolicy.KEY_TEMPLATES)
            Log.d(TAG, "Template refreshed: ${dto.id}")
        } catch (e: Exception) {
            Log.w(TAG, "Template refresh failed, using cache", e)
        }
    }

    private suspend fun refreshCampaigns() {
        try {
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
            cachePolicy.markRefreshed(CachePolicy.KEY_CAMPAIGNS)
            Log.d(TAG, "Campaigns refreshed: ${entities.size} items")
        } catch (e: Exception) {
            Log.w(TAG, "Campaign refresh failed, using cache", e)
        }
    }
}
