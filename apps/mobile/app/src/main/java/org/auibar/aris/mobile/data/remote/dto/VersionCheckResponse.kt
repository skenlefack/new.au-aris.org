package org.auibar.aris.mobile.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class VersionCheckResponse(
    val latestVersion: String,
    val minVersion: String? = null,
    val downloadUrl: String,
    val releaseNotes: String? = null,
)
