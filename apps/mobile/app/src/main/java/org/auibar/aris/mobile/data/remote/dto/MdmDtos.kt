package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class MdmEnrollRequest(
    val hardwareId: String,
    val deviceName: String,
    val deviceModel: String,
    val manufacturer: String,
    val osVersion: String,
    val appVersion: String,
    val screenResolution: String? = null,
    val totalStorageMb: Int? = null,
    val totalRamMb: Int? = null,
)

@Serializable
data class MdmEnrollResponse(
    val id: String,
    val deviceToken: String,
)

@Serializable
data class MdmHeartbeatRequest(
    val deviceToken: String,
    val batteryLevel: Int? = null,
    val isCharging: Boolean = false,
    val networkType: String? = null,
    val storageFreeMb: Int? = null,
    val appVersion: String,
    val lastSyncAt: String? = null,
    val pendingSyncItems: Int = 0,
    val location: MdmLocation? = null,
)

@Serializable
data class MdmLocation(
    val lat: Double,
    val lng: Double,
    val accuracy: Float? = null,
)

@Serializable
data class MdmHeartbeatResponse(
    val commands: List<MdmCommandDto> = emptyList(),
    val update: MdmUpdateDto? = null,
)

@Serializable
data class MdmCommandDto(
    val id: String,
    val type: String,
    val payload: JsonObject? = null,
)

@Serializable
data class MdmUpdateDto(
    val id: String,
    val versionName: String,
    val versionCode: Int,
    val releaseNotes: String? = null,
    val fileUrl: String,
    val fileSize: Int = 0,
    val fileSha256: String? = null,
    val isRequired: Boolean = false,
)

@Serializable
data class MdmAckRequest(
    val status: String,
    val result: JsonObject? = null,
)
