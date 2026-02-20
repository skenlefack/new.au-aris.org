package org.auibar.aris.mobile.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.MainActivity
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.repository.GpsTrackRepository
import javax.inject.Inject

@AndroidEntryPoint
class GpsTrackingService : Service() {

    @Inject
    lateinit var gpsTrackRepository: GpsTrackRepository

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var trackId: String? = null
    private var pointCount = 0

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            val currentTrackId = trackId ?: return

            serviceScope.launch {
                try {
                    pointCount = gpsTrackRepository.addPoint(
                        currentTrackId,
                        location.latitude,
                        location.longitude,
                    )
                    updateNotification()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to add GPS point", e)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                trackId = intent.getStringExtra(EXTRA_TRACK_ID)
                startForeground(NOTIFICATION_ID, buildNotification())
                startLocationUpdates()
            }
            ACTION_STOP -> {
                stopLocationUpdates()
                val currentTrackId = trackId
                if (currentTrackId != null) {
                    serviceScope.launch {
                        gpsTrackRepository.stopTrack(currentTrackId)
                    }
                }
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
    }

    @Suppress("MissingPermission")
    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_INTERVAL_MS,
        ).setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
            .build()

        fusedLocationClient.requestLocationUpdates(
            request,
            locationCallback,
            Looper.getMainLooper(),
        )
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.gps_tracking_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.gps_tracking_desc)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.gps_tracking_notification))
            .setContentText(getString(R.string.tracking_active))
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification() {
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.gps_tracking_notification))
            .setContentText(getString(R.string.track_points, pointCount))
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val TAG = "GpsTrackingService"
        private const val CHANNEL_ID = "gps_tracking"
        private const val NOTIFICATION_ID = 2001
        private const val LOCATION_INTERVAL_MS = 10_000L
        private const val LOCATION_FASTEST_INTERVAL_MS = 5_000L

        const val ACTION_START = "ACTION_START_TRACKING"
        const val ACTION_STOP = "ACTION_STOP_TRACKING"
        const val EXTRA_TRACK_ID = "track_id"

        fun start(context: Context, trackId: String) {
            val intent = Intent(context, GpsTrackingService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TRACK_ID, trackId)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, GpsTrackingService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
