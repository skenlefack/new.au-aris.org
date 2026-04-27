package org.auibar.aris.mobile.data.mapper

import org.auibar.aris.mobile.data.local.entity.CampaignTargetEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateTargetEntity
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateDto
import org.auibar.aris.mobile.data.remote.dto.TargetDto
import org.auibar.aris.mobile.ui.components.RoleConfig

object TargetMapper {

    fun campaignTargetsFromDto(dto: CampaignDto, syncedAt: Long): List<CampaignTargetEntity> {
        val targets = dto.targets
        if (!targets.isNullOrEmpty()) {
            return targets.map { t ->
                CampaignTargetEntity(
                    id = t.id,
                    campaignId = dto.id,
                    domainCode = RoleConfig.backendToMobileKey(t.domainCode),
                    subDomainCode = t.subDomainCode,
                    isPrimary = t.isPrimary,
                    syncedAt = syncedAt,
                )
            }
        }
        // Fallback: generate a single target from the legacy domain field
        return listOf(
            CampaignTargetEntity(
                id = "${dto.id}_legacy",
                campaignId = dto.id,
                domainCode = RoleConfig.backendToMobileKey(dto.domain),
                subDomainCode = null,
                isPrimary = true,
                syncedAt = syncedAt,
            )
        )
    }

    fun templateTargetsFromDto(dto: FormTemplateDto, syncedAt: Long): List<FormTemplateTargetEntity> {
        val targets = dto.targets
        if (!targets.isNullOrEmpty()) {
            return targets.map { t ->
                FormTemplateTargetEntity(
                    id = t.id,
                    templateId = dto.id,
                    domainCode = RoleConfig.backendToMobileKey(t.domainCode),
                    subDomainCode = t.subDomainCode,
                    isPrimary = t.isPrimary,
                    syncedAt = syncedAt,
                )
            }
        }
        return listOf(
            FormTemplateTargetEntity(
                id = "${dto.id}_legacy",
                templateId = dto.id,
                domainCode = RoleConfig.backendToMobileKey(dto.domain),
                subDomainCode = null,
                isPrimary = true,
                syncedAt = syncedAt,
            )
        )
    }
}
