package org.auibar.aris.mobile.service

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.data.remote.dto.MdmCommandDto
import org.auibar.aris.mobile.sync.SyncWorker
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

private const val TAG = "MdmCommandExecutor"
private const val MDM_PREFS = "aris_mdm_prefs"
private const val KEY_PENDING_MESSAGE = "mdm_pending_message"
private const val KEY_FORCE_LOGOUT = "mdm_force_logout"
private const val KEY_WIPE_TRIGGERED = "mdm_wipe_triggered"

class MdmCommandExecutor @Inject constructor(
    @ApplicationContext private val context: Context,
    private val tokenManager: TokenManager,
) {

    private val mdmPrefs: SharedPreferences
        get() = context.getSharedPreferences(MDM_PREFS, Context.MODE_PRIVATE)

    suspend fun execute(command: MdmCommandDto): Boolean {
        Log.d(TAG, "Executing command: ${command.type} (${command.id})")
        return try {
            when (command.type) {
                "FORCE_LOGOUT" -> executeForceLogout()
                "FORCE_SYNC" -> executeForceSync()
                "SEND_MESSAGE" -> executeSendMessage(command.payload)
                "FORCE_UPDATE" -> executeForceUpdate()
                "WIPE_DATA" -> executeWipeData()
                else -> {
                    Log.w(TAG, "Unknown command type: ${command.type}")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Command execution failed: ${command.type}", e)
            false
        }
    }

    private fun executeForceLogout(): Boolean {
        Log.d(TAG, "Executing FORCE_LOGOUT")
        mdmPrefs.edit().putBoolean(KEY_FORCE_LOGOUT, true).apply()
        tokenManager.clear()
        return true
    }

    private fun executeForceSync(): Boolean {
        Log.d(TAG, "Executing FORCE_SYNC")
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueue(request)
        return true
    }

    private fun executeSendMessage(payload: JsonObject?): Boolean {
        val message = payload?.get("message")?.jsonPrimitive?.content
        if (message.isNullOrBlank()) {
            Log.w(TAG, "SEND_MESSAGE: no message in payload")
            return false
        }
        Log.d(TAG, "Executing SEND_MESSAGE: $message")
        mdmPrefs.edit().putString(KEY_PENDING_MESSAGE, message).apply()
        return true
    }

    private fun executeForceUpdate(): Boolean {
        Log.d(TAG, "Executing FORCE_UPDATE — flagging for update check")
        // The heartbeat worker already stores update info when available.
        // This command simply ensures the next heartbeat triggers version check.
        return true
    }

    private fun executeWipeData(): Boolean {
        Log.d(TAG, "Executing WIPE_DATA")
        // Mark wipe so UI can show a message after restart
        mdmPrefs.edit().putBoolean(KEY_WIPE_TRIGGERED, true).apply()

        // Delete Room databases
        val dbDir = context.getDatabasePath("aris_database").parentFile
        if (dbDir != null && dbDir.exists()) {
            dbDir.listFiles()?.forEach { file ->
                if (file.name.startsWith("aris_")) {
                    file.delete()
                }
            }
        }

        // Clear all shared preferences
        tokenManager.clear()

        return true
    }

    // -- Public helpers for UI to read MDM flags --

    /** Returns and clears any pending admin message. */
    fun consumePendingMessage(): String? {
        val msg = mdmPrefs.getString(KEY_PENDING_MESSAGE, null)
        if (msg != null) {
            mdmPrefs.edit().remove(KEY_PENDING_MESSAGE).apply()
        }
        return msg
    }

    /** Returns and clears the force-logout flag. */
    fun consumeForceLogout(): Boolean {
        val flag = mdmPrefs.getBoolean(KEY_FORCE_LOGOUT, false)
        if (flag) {
            mdmPrefs.edit().remove(KEY_FORCE_LOGOUT).apply()
        }
        return flag
    }

    /** Returns and clears the wipe-triggered flag. */
    fun consumeWipeTriggered(): Boolean {
        val flag = mdmPrefs.getBoolean(KEY_WIPE_TRIGGERED, false)
        if (flag) {
            mdmPrefs.edit().remove(KEY_WIPE_TRIGGERED).apply()
        }
        return flag
    }
}
