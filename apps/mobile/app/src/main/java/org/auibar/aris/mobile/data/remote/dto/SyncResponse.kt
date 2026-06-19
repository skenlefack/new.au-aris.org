package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Resolve a name that may be a plain string or a JSON i18n object like
 * `{"en":"English","fr":"Français","pt":"Português","ar":"عربي"}`.
 * Returns the best locale match or falls back to first available value.
 */
fun resolveI18nName(raw: String, locale: String = "en"): String {
    val trimmed = raw.trim()
    if (!trimmed.startsWith("{")) return trimmed
    return try {
        val obj = Json.parseToJsonElement(trimmed).jsonObject
        obj[locale]?.jsonPrimitive?.content
            ?: obj["en"]?.jsonPrimitive?.content
            ?: obj["fr"]?.jsonPrimitive?.content
            ?: obj.values.firstOrNull()?.jsonPrimitive?.content
            ?: trimmed
    } catch (_: Exception) {
        trimmed
    }
}

@Serializable
data class SyncResponse(
    val accepted: List<String>,
    val rejected: List<RejectedSubmission>,
    val conflicts: List<ConflictSubmission>,
    val updatedCampaigns: List<CampaignDto>,
    val updatedTemplates: List<FormTemplateDto>,
    val updatedReferentials: ReferentialUpdates,
    val workflowUpdates: List<WorkflowUpdateDto> = emptyList(),
    val qualityResults: List<QualityResultDto> = emptyList(),
)

@Serializable
data class RejectedSubmission(
    val id: String,
    val errors: List<String>,
)

@Serializable
data class ConflictSubmission(
    val id: String,
    val serverVersion: String,
)

@Serializable
data class TargetDto(
    val id: String,
    val domainCode: String,
    val subDomainCode: String? = null,
    val isPrimary: Boolean = false,
)

@Serializable
data class CampaignDto(
    val id: String,
    val tenantId: String,
    val name: String,
    val domain: String,
    val templateId: String,
    val templateIds: List<String> = emptyList(),
    val targetCountries: List<String> = emptyList(),
    val startDate: String,
    val endDate: String,
    val status: String,
    val description: String? = null,
    val targetSubmissions: Int? = null,
    val assignedAgents: List<String> = emptyList(),
    val targets: List<TargetDto>? = null,
    val createdBy: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class CampaignDetailDto(
    val id: String,
    val tenantId: String,
    val name: String,
    val domain: String,
    val templateId: String? = null,
    val templateIds: List<String> = emptyList(),
    val targetCountries: List<String> = emptyList(),
    val startDate: String,
    val endDate: String,
    val status: String,
    val description: String? = null,
    val targetSubmissions: Int? = null,
    val assignedAgents: List<String> = emptyList(),
    val targets: List<TargetDto>? = null,
    val progress: CampaignProgressDto? = null,
    val createdAt: String? = null,
)

@Serializable
data class CampaignProgressDto(
    val totalSubmissions: Int = 0,
    val validated: Int = 0,
    val rejected: Int = 0,
    val pending: Int = 0,
    val completionRate: Double = 0.0,
)

@Serializable
data class TemplateInfoDto(
    val id: String,
    val name: String,
    val domain: String? = null,
    val version: Int = 1,
    val status: String? = null,
)

/** Summary DTO for template list (without schema/uiSchema). */
@Serializable
data class FormTemplateSummaryDto(
    val id: String,
    val name: String,
    val domain: String = "",
    val formType: String = "CAMPAIGN",
    val version: Int = 1,
    val status: String = "PUBLISHED",
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class FormTemplateDto(
    val id: String,
    val name: String,
    val domain: String,
    val schema: String,
    val uiSchema: String,
    val version: Int,
    val targets: List<TargetDto>? = null,
)

@Serializable
data class ReferentialUpdates(
    val species: List<SpeciesDto> = emptyList(),
    val diseases: List<DiseaseDto> = emptyList(),
    val geoUnits: List<GeoDto> = emptyList(),
)

@Serializable
data class SpeciesDto(
    val id: String,
    val commonName: String? = null,
    val commonNameEn: String? = null,
    val commonNameFr: String? = null,
    val scientificName: String? = null,
    val name: String? = null,
    val category: String? = null,
    val code: String? = null,
) {
    val resolvedName: String get() = commonNameEn ?: commonName ?: commonNameFr ?: name ?: code ?: id
}

@Serializable
data class DiseaseDto(
    val id: String,
    val name: String? = null,
    val nameEn: String? = null,
    val nameFr: String? = null,
    val woahCode: String? = null,
    val wahisCategory: String? = null,
    val category: String? = null,
    val isNotifiable: Boolean = false,
    val isWoahListed: Boolean = false,
    val code: String? = null,
) {
    val resolvedName: String get() = nameEn ?: name ?: nameFr ?: code ?: id
}

@Serializable
data class GeoDto(
    val id: String,
    val name: String,
    val level: String,
    val parentId: String? = null,
    val isoCode: String? = null,
)

@Serializable
data class WorkflowUpdateDto(
    val submissionId: String,
    val level: Int,
    val status: String,
)

@Serializable
data class QualityResultDto(
    val submissionId: String,
    val results: String,
)
