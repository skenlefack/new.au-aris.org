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
import io.ktor.client.call.body
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import org.auibar.aris.mobile.data.local.dao.PhotoDao
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import java.io.File

@HiltWorker
class PhotoUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val photoDao: PhotoDao,
    private val client: HttpClient,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val pending = photoDao.getPendingUpload()
        if (pending.isEmpty()) {
            Log.d(TAG, "No photos to upload")
            return Result.success()
        }

        Log.d(TAG, "Uploading ${pending.size} photos...")
        var successCount = 0

        for (photo in pending) {
            try {
                val file = File(photo.filePath)
                if (!file.exists()) {
                    photoDao.updateUploadError(photo.id, "FAILED", "File not found")
                    continue
                }

                photoDao.updateUploadStatus(photo.id, "UPLOADING", null)

                val response: ApiResponse<UploadResult> = client.submitFormWithBinaryData(
                    url = "/api/v1/drive/upload",
                    formData = formData {
                        append("file", file.readBytes(), Headers.build {
                            append(HttpHeaders.ContentDisposition, "filename=\"${file.name}\"")
                            append(HttpHeaders.ContentType, "image/jpeg")
                        })
                        append("entityType", "submission_photo")
                        append("entityId", photo.submissionId)
                    },
                ).body()

                val serverUrl = response.data?.url
                if (serverUrl != null) {
                    photoDao.updateUploadStatus(photo.id, "UPLOADED", serverUrl)
                    successCount++
                } else {
                    photoDao.updateUploadError(photo.id, "FAILED", "No URL in response")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to upload photo ${photo.id}", e)
                photoDao.updateUploadError(photo.id, "FAILED", e.message)
            }
        }

        Log.d(TAG, "Upload complete: $successCount/${pending.size} succeeded")
        return Result.success()
    }

    @kotlinx.serialization.Serializable
    private data class UploadResult(val url: String)

    companion object {
        private const val TAG = "PhotoUploadWorker"
        const val WORK_NAME = "aris_photo_upload"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<PhotoUploadWorker>()
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
