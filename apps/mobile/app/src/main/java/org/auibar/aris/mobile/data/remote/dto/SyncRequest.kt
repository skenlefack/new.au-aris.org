package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class SyncRequest(
    val submissions: List<SubmissionDto>,
    val lastSyncAt: Long? = null,
    val deviceId: String? = null,
    val clientVersion: String? = null,
    val platform: String = "android",
)

@Serializable
data class SubmissionDto(
    val id: String,
    val tenantId: String,
    val campaignId: String,
    val templateId: String,
    val data: String,
    val domain: String? = null,
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsAccuracy: Float? = null,
    val offlineCreatedAt: Long,
)
