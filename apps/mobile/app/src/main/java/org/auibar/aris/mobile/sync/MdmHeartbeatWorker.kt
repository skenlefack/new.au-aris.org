package org.auibar.aris.mobile.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.data.remote.dto.MdmUpdateDto
import org.auibar.aris.mobile.data.repository.MdmRepository
import org.auibar.aris.mobile.service.MdmCommandExecutor
import java.util.concurrent.TimeUnit

private const val TAG = "MdmHeartbeatWorker"
private const val MDM_PREFS = "aris_mdm_prefs"
private const val KEY_DEVICE_TOKEN = "mdm_device_token"
private const val KEY_PENDING_UPDATE = "mdm_pending_update"
private const val MAX_RETRIES = 3

@HiltWorker
class MdmHeartbeatWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val mdmRepository: MdmRepository,
    private val commandExecutor: MdmCommandExecutor,
    private val json: Json,
) : CoroutineWorker(appContext, params) {

    private val mdmPrefs: SharedPreferences
        get() = applicationContext.getSharedPreferences(MDM_PREFS, Context.MODE_PRIVATE)

    override suspend fun doWork(): Result {
        val deviceToken = mdmPrefs.getString(KEY_DEVICE_TOKEN, null)
        if (deviceToken.isNullOrBlank()) {
            Log.w(TAG, "No device token — skipping heartbeat (not enrolled)")
            return Result.success()
        }

        Log.d(TAG, "Sending heartbeat (attempt $runAttemptCount)...")

        val response = mdmRepository.sendHeartbeat(deviceToken)
        if (response == null) {
            Log.w(TAG, "Heartbeat failed")
            return retryOrFail()
        }

        Log.d(TAG, "Heartbeat OK — ${response.commands.size} commands, update=${response.update != null}")

        // Execute pending commands
        for (command in response.commands) {
            val success = commandExecutor.execute(command)
            val status = if (success) "EXECUTED" else "FAILED"
            mdmRepository.ackCommand(command.id, status)
            Log.d(TAG, "Command ${command.type} (${command.id}) -> $status")
        }

        // Store update info if available
        response.update?.let { storeUpdateInfo(it) }

        return Result.success()
    }

    private fun retryOrFail(): Result {
        return if (runAttemptCount >= MAX_RETRIES) {
            Log.e(TAG, "Heartbeat giving up after $runAttemptCount attempts")
            Result.failure()
        } else {
            Result.retry()
        }
    }

    private fun storeUpdateInfo(update: MdmUpdateDto) {
        try {
            val serialized = json.encodeToString(update)
            mdmPrefs.edit().putString(KEY_PENDING_UPDATE, serialized).apply()
            Log.d(TAG, "Stored pending update: ${update.versionName} (code ${update.versionCode})")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to store update info: ${e.message}")
        }
    }

    companion object {
        const val WORK_NAME = "aris_mdm_heartbeat"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<MdmHeartbeatWorker>(
                15, TimeUnit.MINUTES,
            ).setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        /** Save device token after enrollment. */
        fun saveDeviceToken(context: Context, token: String) {
            context.getSharedPreferences(MDM_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_DEVICE_TOKEN, token)
                .apply()
        }

        /** Get the stored device token. */
        fun getDeviceToken(context: Context): String? {
            return context.getSharedPreferences(MDM_PREFS, Context.MODE_PRIVATE)
                .getString(KEY_DEVICE_TOKEN, null)
        }

        /** Read and clear stored pending update info. */
        fun consumePendingUpdate(context: Context, json: Json): MdmUpdateDto? {
            val prefs = context.getSharedPreferences(MDM_PREFS, Context.MODE_PRIVATE)
            val raw = prefs.getString(KEY_PENDING_UPDATE, null) ?: return null
            prefs.edit().remove(KEY_PENDING_UPDATE).apply()
            return try {
                json.decodeFromString<MdmUpdateDto>(raw)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to decode pending update: ${e.message}")
                null
            }
        }
    }
}
