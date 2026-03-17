package org.auibar.aris.mobile.data.remote.websocket

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.local.dao.NotificationDao
import org.auibar.aris.mobile.data.local.entity.NotificationEntity
import org.auibar.aris.mobile.data.remote.api.AuthApi
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min
import kotlin.math.pow

/**
 * Incoming real-time event from the WebSocket server.
 */
data class RealtimeEvent(
    val type: String,     // "outbreak_alert", "notification", "sync_update"
    val title: String,
    val body: String,
    val payload: Map<String, String> = emptyMap(),
)

/**
 * Manages the Socket.IO connection to the ARIS realtime service.
 *
 * - Connects after login with JWT auth
 * - Subscribes to tenant and user rooms
 * - Reconnects with exponential backoff on disconnect
 * - Emits incoming events as a SharedFlow
 */
@Singleton
class WebSocketManager @Inject constructor(
    private val tokenManager: TokenManager,
    private val notificationDao: NotificationDao,
    private val authApi: AuthApi,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var socket: Socket? = null

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()

    /** Current reconnect attempt count (reset on successful connect) */
    @Volatile
    var reconnectAttempt: Int = 0
        private set

    @Volatile
    private var shouldReconnect = false

    /**
     * Connect to the realtime service. Call after successful login.
     */
    fun connect() {
        if (socket?.connected() == true) return

        val token = tokenManager.accessToken ?: return
        val tenantId = tokenManager.tenantId ?: return
        val userId = tokenManager.userId ?: return

        shouldReconnect = true
        reconnectAttempt = 0

        try {
            val baseUrl = BuildConfig.API_BASE_URL
                .replace(Regex(":\\d+$"), ":3008") // realtime service port
            val opts = IO.Options().apply {
                auth = mapOf("token" to token)
                transports = arrayOf("websocket")
                reconnection = false // We handle reconnection ourselves
            }

            socket = IO.socket(baseUrl, opts).apply {
                on(Socket.EVENT_CONNECT) {
                    Log.d(TAG, "WebSocket connected")
                    _connectionState.value = ConnectionState.CONNECTED
                    reconnectAttempt = 0

                    // Join tenant and user rooms
                    emit("join", JSONObject().apply {
                        put("room", "tenant:$tenantId")
                    })
                    emit("join", JSONObject().apply {
                        put("room", "user:$userId")
                    })
                    Log.d(TAG, "Joined rooms: tenant:$tenantId, user:$userId")
                }

                on(Socket.EVENT_DISCONNECT) {
                    Log.d(TAG, "WebSocket disconnected")
                    _connectionState.value = ConnectionState.DISCONNECTED
                    if (shouldReconnect) {
                        scheduleReconnect()
                    }
                }

                on(Socket.EVENT_CONNECT_ERROR) { args ->
                    val error = args.firstOrNull()
                    Log.w(TAG, "WebSocket connect error: $error")
                    _connectionState.value = ConnectionState.ERROR
                    if (shouldReconnect) {
                        scheduleReconnect()
                    }
                }

                // Outbreak alerts (tenant room)
                on("outbreak_alert") { args ->
                    handleEvent("outbreak_alert", args)
                }

                // Personal notifications (user room)
                on("notification") { args ->
                    handleEvent("notification", args)
                }

                // Sync updates
                on("sync_update") { args ->
                    handleEvent("sync_update", args)
                }
            }

            _connectionState.value = ConnectionState.CONNECTING
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create socket", e)
            _connectionState.value = ConnectionState.ERROR
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }
    }

    /**
     * Disconnect and stop reconnection attempts.
     */
    fun disconnect() {
        shouldReconnect = false
        reconnectAttempt = 0
        socket?.disconnect()
        socket?.off()
        socket = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    private fun handleEvent(type: String, args: Array<Any>) {
        try {
            val json = args.firstOrNull() as? JSONObject ?: return
            val event = RealtimeEvent(
                type = type,
                title = json.optString("title", "ARIS Alert"),
                body = json.optString("body", ""),
                payload = buildMap {
                    json.keys().forEach { key ->
                        put(key, json.optString(key, ""))
                    }
                },
            )
            scope.launch {
                _events.emit(event)
                // Persist to Room for notification history
                notificationDao.insert(
                    NotificationEntity(
                        id = json.optString("id", java.util.UUID.randomUUID().toString()),
                        tenantId = tokenManager.tenantId ?: "",
                        title = event.title,
                        body = event.body,
                        type = event.type,
                        createdAt = System.currentTimeMillis(),
                    ),
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse event: $type", e)
        }
    }

    private fun scheduleReconnect() {
        scope.launch {
            reconnectAttempt++
            val delayMs = calculateBackoff(reconnectAttempt)
            Log.d(TAG, "Reconnecting in ${delayMs}ms (attempt $reconnectAttempt)")
            _connectionState.value = ConnectionState.RECONNECTING
            delay(delayMs)
            if (shouldReconnect) {
                // Proactively refresh the access token before reconnecting
                val refreshed = refreshTokenIfNeeded()
                if (!refreshed) {
                    Log.w(TAG, "No valid token, stopping reconnect")
                    shouldReconnect = false
                    _connectionState.value = ConnectionState.DISCONNECTED
                    return@launch
                }
                socket?.off()
                socket = null
                connect()
            }
        }
    }

    /**
     * Attempt to refresh the access token using the refresh token.
     * Returns true if a valid access token is available after the attempt.
     */
    private suspend fun refreshTokenIfNeeded(): Boolean {
        if (tokenManager.accessToken != null) return true
        val refresh = tokenManager.refreshToken ?: return false
        return try {
            val response = authApi.refreshToken(refresh)
            tokenManager.accessToken = response.data.accessToken
            tokenManager.refreshToken = response.data.refreshToken
            Log.d(TAG, "Token refreshed for WebSocket reconnect")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Token refresh failed for WebSocket", e)
            false
        }
    }

    companion object {
        private const val TAG = "WebSocketManager"
        private const val BASE_DELAY_MS = 1000L
        private const val MAX_DELAY_MS = 30_000L

        /**
         * Exponential backoff: base * 2^(attempt-1), capped at MAX_DELAY_MS.
         * Visible for testing.
         */
        fun calculateBackoff(attempt: Int): Long {
            val delay = BASE_DELAY_MS * 2.0.pow((attempt - 1).coerceAtLeast(0)).toLong()
            return min(delay, MAX_DELAY_MS)
        }
    }
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    ERROR,
}
