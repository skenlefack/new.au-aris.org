package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.CampaignTargetDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.CampaignTargetEntity
import org.auibar.aris.mobile.data.mapper.TargetMapper
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.resolveI18nName
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.ui.components.TargetUiModel
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import timber.log.Timber
import javax.inject.Inject

data class CampaignTarget(
    val id: String,
    val domainCode: String,
    val subDomainCode: String?,
    val isPrimary: Boolean,
)

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
    val targets: List<CampaignTarget> = emptyList(),
) {
    val pendingSubmissions: Int get() = totalSubmissions - validatedSubmissions - rejectedSubmissions

    val completionRate: Double
        get() {
            val target = targetSubmissions ?: totalSubmissions.coerceAtLeast(1)
            return if (target > 0) (totalSubmissions.toDouble() / target * 100.0).coerceAtMost(100.0) else 0.0
        }

    val targetUiModels: List<TargetUiModel>
        get() = targets.map { t ->
            TargetUiModel(
                domainCode = t.domainCode,
                domainLabel = DOMAIN_LABELS[t.domainCode] ?: t.domainCode,
                subDomainCode = t.subDomainCode,
                subDomainLabel = t.subDomainCode,
                isPrimary = t.isPrimary,
            )
        }
}

private val DOMAIN_LABELS = mapOf(
    "health" to "Animal Health",
    "livestock" to "Livestock",
    "fisheries" to "Fisheries",
    "trade" to "Trade & SPS",
    "wildlife" to "Wildlife",
    "apiculture" to "Apiculture",
    "governance" to "Governance",
    "climate" to "Climate",
    "knowledge" to "Knowledge",
    "paid" to "PAID",
)

class CampaignRepository @Inject constructor(
    private val campaignDao: CampaignDao,
    private val campaignTargetDao: CampaignTargetDao,
    private val campaignApi: CampaignApi,
) {
    companion object {
        fun parseIsoDate(dateStr: String?): Long {
            if (dateStr.isNullOrBlank()) return 0L
            return try {
                val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val cleaned = dateStr.replace(Regex("\\.[0-9]+Z$"), "")
                    .replace("Z", "")
                fmt.parse(cleaned)?.time ?: 0L
            } catch (e: Exception) {
                Timber.w(e, "Failed to parse date: $dateStr")
                0L
            }
        }
    }

    suspend fun getById(id: String): Campaign? {
        val entity = campaignDao.getById(id) ?: return null
        val targets = campaignTargetDao.getForCampaign(id)
        return entity.toDomain(targets)
    }

    fun observeById(id: String): Flow<Campaign?> {
        return combine(
            campaignDao.observeById(id),
            campaignTargetDao.observeForCampaign(id),
        ) { entity, targets ->
            entity?.toDomain(targets)
        }
    }

    fun getActiveCampaigns(): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaigns().map { entities ->
            entities.map { it.toDomain(emptyList()) }
        }
    }

    /** All campaigns for a domain (all statuses). */
    fun getAllCampaignsByDomain(domain: String): Flow<List<Campaign>> {
        return campaignDao.getAllCampaignsByDomain(domain).map { entities ->
            entities.map { it.toDomain(emptyList()) }
        }
    }

    fun getActiveCampaignsByDomain(domain: String): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaignsByDomain(domain).map { entities ->
            entities.map { it.toDomain(emptyList()) }
        }
    }

    fun getActiveCampaignsByDomains(domains: List<String>): Flow<List<Campaign>> {
        return campaignDao.getActiveCampaignsByDomains(domains).map { entities ->
            entities.map { it.toDomain(emptyList()) }
        }
    }

    /** Observe campaigns matching a target domainCode via the campaign_targets join table. */
    fun observeCampaignsByTarget(domainCode: String): Flow<List<Campaign>> {
        return campaignTargetDao.observeCampaignsByTarget(domainCode).map { entities ->
            entities.map { it.toDomain(emptyList()) }
        }
    }

    suspend fun refreshCampaigns(): Result<Unit> {
        return try {
            val response = campaignApi.getActiveCampaigns()
            val now = System.currentTimeMillis()
            val entities = response.data.map { it.toEntity(now) }
            campaignDao.upsertAll(entities)
            // Persist targets for each campaign
            response.data.forEach { dto ->
                val targets = TargetMapper.campaignTargetsFromDto(dto, now)
                campaignTargetDao.replaceForCampaign(dto.id, targets)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh campaigns")
            Result.failure(e)
        }
    }

    suspend fun refreshCampaignDetail(campaignId: String): Result<Campaign> {
        return try {
            val response = campaignApi.getCampaignDetail(campaignId)
            val detail = response.data
            val now = System.currentTimeMillis()
            val entity = CampaignEntity(
                id = detail.id,
                tenantId = detail.tenantId,
                name = resolveI18nName(detail.name),
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

            // Persist targets from detail DTO
            val detailTargets = detail.targets
            if (!detailTargets.isNullOrEmpty()) {
                val targetEntities = detailTargets.map { t ->
                    CampaignTargetEntity(
                        id = t.id,
                        campaignId = detail.id,
                        domainCode = RoleConfig.backendToMobileKey(t.domainCode),
                        subDomainCode = t.subDomainCode,
                        isPrimary = t.isPrimary,
                        syncedAt = now,
                    )
                }
                campaignTargetDao.replaceForCampaign(detail.id, targetEntities)
            }

            val savedTargets = campaignTargetDao.getForCampaign(campaignId)
            Result.success(entity.toDomain(savedTargets))
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh campaign detail: $campaignId")
            Result.failure(e)
        }
    }

    private fun CampaignEntity.toDomain(targets: List<CampaignTargetEntity> = emptyList()) = Campaign(
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
        targets = targets.map { t ->
            CampaignTarget(
                id = t.id,
                domainCode = t.domainCode,
                subDomainCode = t.subDomainCode,
                isPrimary = t.isPrimary,
            )
        },
    )
}

fun CampaignDto.toEntity(syncedAt: Long): CampaignEntity {
    return CampaignEntity(
        id = id,
        tenantId = tenantId,
        name = resolveI18nName(name),
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
