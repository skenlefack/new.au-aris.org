package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class SyncResponse(
    val accepted: List<String>,
    val rejected: List<RejectedSubmission>,
    val conflicts: List<ConflictSubmission>,
    val updatedCampaigns: List<CampaignDto>,
    val updatedTemplates: List<FormTemplateDto>,
    val updatedReferentials: ReferentialUpdates,
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
data class CampaignDto(
    val id: String,
    val tenantId: String,
    val name: String,
    val domain: String,
    val templateId: String,
    val startDate: Long,
    val endDate: Long,
    val status: String,
)

@Serializable
data class FormTemplateDto(
    val id: String,
    val name: String,
    val domain: String,
    val schema: String,
    val uiSchema: String,
    val version: Int,
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
    val commonName: String,
    val scientificName: String,
    val category: String,
)

@Serializable
data class DiseaseDto(
    val id: String,
    val name: String,
    val woahCode: String? = null,
    val category: String,
    val isNotifiable: Boolean,
)

@Serializable
data class GeoDto(
    val id: String,
    val name: String,
    val level: String,
    val parentId: String? = null,
    val isoCode: String? = null,
)
