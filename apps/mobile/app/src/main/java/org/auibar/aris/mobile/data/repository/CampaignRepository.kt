package org.auibar.aris.mobile.data.repository

import android.util.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.ui.components.RoleConfig
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
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
    val description: String? = null,
    val targetSubmissions: Int? = null,
    val totalSubmissions: Int = 0,
    val validatedSubmissions: Int = 0,
    val rejectedSubmissions: Int = 0,
) {
    val pendingSubmissions: Int get() = totalSubmissions - validatedSubmissions - rejectedSubmissions

    val completionRate: Double
        get() {
            val target = targetSubmissions ?: totalSubmissions.coerceAtLeast(1)
            return if (target > 0) (validatedSubmissions.toDouble() / target * 100.0) else 0.0
        }
}

class CampaignRepository @Inject constructor(
    private val campaignDao: CampaignDao,
    private val campaignApi: CampaignApi,
) {
    companion object {
        private const val TAG = "CampaignRepository"

        /** Parse ISO-8601 date string to epoch millis. Falls back to 0 on error. */
        fun parseIsoDate(dateStr: String?): Long {
            if (dateStr.isNullOrBlank()) return 0L
            return try {
                val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                // Strip fractional seconds and trailing Z for SimpleDateFormat
                val cleaned = dateStr.replace(Regex("\\.[0-9]+Z$"), "")
                    .replace("Z", "")
                fmt.parse(cleaned)?.time ?: 0L
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse date: $dateStr", e)
                0L
            }
        }
    }

    suspend fun getById(id: String): Campaign? {
        return campaignDao.getById(id)?.toDomain()
    }

    fun observeById(id: String): Flow<Campaign?> {
        return campaignDao.observeById(id).map { it?.toDomain() }
    }

    fun getActiveCampaigns(): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaigns().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getActiveCampaignsByDomain(domain: String): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaignsByDomain(domain).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getActiveCampaignsByDomains(domains: List<String>): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaignsByDomains(domains).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    suspend fun refreshCampaigns(): Result<Unit> {
        return try {
            val response = campaignApi.getActiveCampaigns()
            val now = System.currentTimeMillis()
            val entities = response.data.map { it.toEntity(now) }
            campaignDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to refresh campaigns", e)
            Result.failure(e)
        }
    }

    /** Refresh a single campaign's detail (with progress stats). */
    suspend fun refreshCampaignDetail(campaignId: String): Result<Campaign> {
        return try {
            val response = campaignApi.getCampaignDetail(campaignId)
            val detail = response.data
            val now = System.currentTimeMillis()
            val entity = CampaignEntity(
                id = detail.id,
                tenantId = detail.tenantId,
                name = detail.name,
                domain = RoleConfig.backendToMobileKey(detail.domain),
                templateId = detail.templateId ?: detail.templateIds.firstOrNull() ?: "",
                startDate = parseIsoDate(detail.startDate),
                endDate = parseIsoDate(detail.endDate),
                status = detail.status,
                description = detail.description,
                targetSubmissions = detail.targetSubmissions,
                totalSubmissions = detail.progress?.totalSubmissions ?: 0,
                validatedSubmissions = detail.progress?.validated ?: 0,
                rejectedSubmissions = detail.progress?.rejected ?: 0,
                syncedAt = now,
            )
            campaignDao.upsertAll(listOf(entity))
            Result.success(entity.toDomain())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to refresh campaign detail: $campaignId", e)
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
        description = description,
        targetSubmissions = targetSubmissions,
        totalSubmissions = totalSubmissions,
        validatedSubmissions = validatedSubmissions,
        rejectedSubmissions = rejectedSubmissions,
    )
}

/** Convert API DTO to Room entity. */
fun CampaignDto.toEntity(syncedAt: Long): CampaignEntity {
    return CampaignEntity(
        id = id,
        tenantId = tenantId,
        name = name,
        domain = RoleConfig.backendToMobileKey(domain),
        templateId = templateId,
        startDate = CampaignRepository.parseIsoDate(startDate),
        endDate = CampaignRepository.parseIsoDate(endDate),
        status = status,
        description = description,
        targetSubmissions = targetSubmissions,
        syncedAt = syncedAt,
    )
}
