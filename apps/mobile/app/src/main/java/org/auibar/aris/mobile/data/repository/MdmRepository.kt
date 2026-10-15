package org.auibar.aris.mobile.data.repository

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.json.JsonObject
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.remote.api.MdmApi
import org.auibar.aris.mobile.data.remote.dto.MdmAckRequest
import org.auibar.aris.mobile.data.remote.dto.MdmEnrollRequest
import org.auibar.aris.mobile.data.remote.dto.MdmEnrollResponse
import org.auibar.aris.mobile.data.remote.dto.MdmHeartbeatRequest
import org.auibar.aris.mobile.data.remote.dto.MdmHeartbeatResponse
import org.auibar.aris.mobile.data.remote.dto.MdmUpdateDto
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

private const val TAG = "MdmRepository"

class MdmRepository @Inject constructor(
    private val api: MdmApi,
    private val tokenManager: TokenManager,
    @ApplicationContext private val context: Context,
) {

    suspend fun enrollDevice(): MdmEnrollResponse? {
        val hardwareId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: tokenManager.deviceId

        val metrics = getDisplayMetrics()
        val screenResolution = "${metrics.widthPixels}x${metrics.heightPixels}"

        val request = MdmEnrollRequest(
            hardwareId = hardwareId,
            deviceName = Build.MODEL,
            deviceModel = Build.MODEL,
            manufacturer = Build.MANUFACTURER,
            osVersion = Build.VERSION.RELEASE,
            appVersion = BuildConfig.VERSION_NAME,
            screenResolution = screenResolution,
            totalStorageMb = getTotalStorageMb(),
            totalRamMb = getTotalRamMb(),
        )

        return api.enroll(request)
    }

    suspend fun sendHeartbeat(deviceToken: String): MdmHeartbeatResponse? {
        val batteryStatus = getBatteryStatus()
        val lastSync = tokenManager.lastSyncAt
        val lastSyncIso = if (lastSync != null && lastSync > 0) {
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                .format(java.util.Date(lastSync))
        } else {
            null
        }

        val request = MdmHeartbeatRequest(
            deviceToken = deviceToken,
            batteryLevel = batteryStatus.first,
            isCharging = batteryStatus.second,
            networkType = getNetworkType(),
            storageFreeMb = getFreeStorageMb(),
            appVersion = BuildConfig.VERSION_NAME,
            lastSyncAt = lastSyncIso,
            pendingSyncItems = 0,
        )

        return api.heartbeat(request)
    }

    suspend fun ackCommand(commandId: String, status: String, result: JsonObject? = null): Boolean {
        return api.acknowledgeCommand(commandId, MdmAckRequest(status, result))
    }

    suspend fun checkForUpdate(): MdmUpdateDto? {
        return api.checkVersion(BuildConfig.VERSION_CODE)
    }

    // -- Device info helpers --

    private fun getDisplayMetrics(): DisplayMetrics {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getMetrics(metrics)
        return metrics
    }

    private fun getTotalStorageMb(): Int {
        return try {
            val stat = StatFs(Environment.getDataDirectory().path)
            (stat.blockSizeLong * stat.blockCountLong / (1024L * 1024L)).toInt()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get total storage: ${e.message}")
            0
        }
    }

    private fun getTotalRamMb(): Int {
        return try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            am.getMemoryInfo(memInfo)
            (memInfo.totalMem / (1024L * 1024L)).toInt()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get total RAM: ${e.message}")
            0
        }
    }

    private fun getFreeStorageMb(): Int {
        return try {
            val stat = StatFs(Environment.getDataDirectory().path)
            (stat.blockSizeLong * stat.availableBlocksLong / (1024L * 1024L)).toInt()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get free storage: ${e.message}")
            0
        }
    }

    /** Returns (batteryLevel 0-100, isCharging). */
    private fun getBatteryStatus(): Pair<Int?, Boolean> {
        return try {
            val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            @Suppress("DEPRECATION")
            val batteryIntent = context.registerReceiver(null, filter)
            if (batteryIntent != null) {
                val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                val pct = if (level >= 0 && scale > 0) (level * 100 / scale) else null
                val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL
                Pair(pct, charging)
            } else {
                Pair(null, false)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get battery status: ${e.message}")
            Pair(null, false)
        }
    }

    private fun getNetworkType(): String {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return "NONE"
            val caps = cm.getNetworkCapabilities(network) ?: return "NONE"
            when {
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
                else -> "OTHER"
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get network type: ${e.message}")
            "UNKNOWN"
        }
    }
}
