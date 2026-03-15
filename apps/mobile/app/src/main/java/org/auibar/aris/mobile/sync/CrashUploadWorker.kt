package org.auibar.aris.mobile.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import org.auibar.aris.mobile.util.CrashLogger
import org.auibar.aris.mobile.util.TokenManager

@HiltWorker
class CrashUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val client: HttpClient,
    private val tokenManager: TokenManager,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val logs = CrashLogger.getLogFiles(applicationContext)
        if (logs.isEmpty()) {
            Log.d(TAG, "No crash logs to upload")
            return Result.success()
        }

        val userId = tokenManager.userId ?: "unknown"
        val tenantId = tokenManager.tenantId ?: "unknown"

        return try {
            for (logFile in logs) {
                val bytes = logFile.readBytes()
                client.submitFormWithBinaryData(
                    url = "/api/v1/message/crash-reports",
                    formData = formData {
                        append("file", bytes, Headers.build {
                            append(HttpHeaders.ContentDisposition, "filename=\"${logFile.name}\"")
                            append(HttpHeaders.ContentType, "text/plain")
                        })
                        append("userId", userId)
                        append("tenantId", tenantId)
                        append("deviceInfo", android.os.Build.MODEL)
                        append("appVersion", getAppVersion())
                    },
                )
                // Delete log after successful upload
                logFile.delete()
                Log.d(TAG, "Uploaded and deleted: ${logFile.name}")
            }
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Crash log upload failed", e)
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private fun getAppVersion(): String {
        return try {
            val pInfo = applicationContext.packageManager
                .getPackageInfo(applicationContext.packageName, 0)
            pInfo.versionName ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
    }

    companion object {
        private const val TAG = "CrashUploadWorker"
        private const val WORK_NAME = "aris_crash_upload"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<CrashUploadWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
