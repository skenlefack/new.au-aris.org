package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class WorkflowCommentBody(val text: String)

@Serializable
data class BulkActionBody(
    val ids: List<String>,
    val action: String,
    val comment: String? = null,
)

@Serializable
data class BulkActionResponse(
    val succeeded: List<String> = emptyList(),
    val failed: List<BulkActionFailure> = emptyList(),
)

@Serializable
data class BulkActionFailure(
    val id: String,
    val error: String = "",
)

@Serializable
data class ConflictResolutionBody(
    val resolution: String, // KEEP_SERVER, KEEP_CLIENT, MERGE
    val mergedData: JsonObject? = null,
)

@Serializable
data class SubmissionUpdateBody(
    val data: JsonObject,
)

@Serializable
data class WorkflowDashboardDto(
    val pendingByLevel: Map<String, Int> = emptyMap(),
    val totalPending: Int = 0,
    val totalInReview: Int = 0,
    val totalApproved: Int = 0,
    val totalRejected: Int = 0,
    val totalEscalated: Int = 0,
    val slaBreaches: Int = 0,
    val wahisReadyCount: Int = 0,
    val analyticsReadyCount: Int = 0,
)

@Serializable
data class SubmissionListItemDto(
    val id: String,
    val tenantId: String = "",
    val campaignId: String = "",
    val templateId: String? = null,
    val status: String = "SUBMITTED",
    val data: JsonObject? = null,
    val version: Int = 1,
    val createdBy: String = "",
    val createdAt: String = "",
    val updatedAt: String = "",
    val conflictStatus: String? = null,
    val conflictClientData: JsonObject? = null,
    val conflictClientVersion: Int? = null,
    val conflictDetectedAt: String? = null,
    val conflictResolvedAt: String? = null,
)

@Serializable
data class FormExtensionDto(
    val id: String,
    val baseFormId: String,
    val campaignId: String,
    val level: String = "",
    val tenantId: String = "",
    val version: Int = 1,
    val status: String = "PUBLISHED",
    val updatedAt: String = "",
)
