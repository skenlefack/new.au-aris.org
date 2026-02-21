package org.auibar.aris.mobile.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.remote.dto.VersionCheckResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdateManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val httpClient: HttpClient,
) {
    /**
     * Check if a new version is available.
     * Returns null if check fails or no update needed.
     */
    suspend fun checkForUpdate(): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val response: VersionCheckResponse = httpClient.get(
                "${BuildConfig.API_BASE_URL}/api/v1/mobile/version-check"
            ) {
                parameter("platform", "android")
                parameter("current", BuildConfig.VERSION_NAME)
            }.body()

            val currentParts = BuildConfig.VERSION_NAME.replace("-alpha", "").split(".")
                .mapNotNull { it.toIntOrNull() }
            val latestParts = response.latestVersion.replace("-alpha", "").split(".")
                .mapNotNull { it.toIntOrNull() }

            val needsUpdate = compareVersions(currentParts, latestParts) < 0

            if (needsUpdate) {
                UpdateInfo(
                    latestVersion = response.latestVersion,
                    downloadUrl = response.downloadUrl,
                    isForceUpdate = response.minVersion?.let { minVer ->
                        val minParts = minVer.replace("-alpha", "").split(".")
                            .mapNotNull { it.toIntOrNull() }
                        compareVersions(currentParts, minParts) < 0
                    } ?: false,
                    releaseNotes = response.releaseNotes,
                )
            } else null
        } catch (_: Exception) {
            null // Silently fail — don't block app usage
        }
    }

    private fun compareVersions(current: List<Int>, other: List<Int>): Int {
        val maxLen = maxOf(current.size, other.size)
        for (i in 0 until maxLen) {
            val c = current.getOrElse(i) { 0 }
            val o = other.getOrElse(i) { 0 }
            if (c != o) return c.compareTo(o)
        }
        return 0
    }

    fun openUpdateUrl(downloadUrl: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}

data class UpdateInfo(
    val latestVersion: String,
    val downloadUrl: String,
    val isForceUpdate: Boolean,
    val releaseNotes: String?,
)
