package com.castmill.androidremote

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

/**
 * WebSocketManager handles the WebSocket connection to the Castmill backend
 * for remote control communication.
 * 
 * This manager:
 * - Establishes WebSocket connection to device_rc channel
 * - Handles Phoenix channel protocol (join, heartbeat, events)
 * - Implements automatic reconnection with exponential backoff
 * - Manages message serialization/deserialization
 * 
 * Phoenix WebSocket Protocol:
 * Messages are arrays: [join_ref, ref, topic, event, payload]
 */
class WebSocketManager(
    private val baseUrl: String,
    private val deviceId: String,
    private val deviceToken: String,
    private val coroutineScope: CoroutineScope
) {
    companion object {
        private const val TAG = "WebSocketManager"
        private const val HEARTBEAT_INTERVAL_MS = 30000L // 30 seconds
        private const val INITIAL_RECONNECT_DELAY_MS = 1000L // 1 second
        private const val MAX_RECONNECT_DELAY_MS = 60000L // 1 minute
        private const val RECONNECT_BACKOFF_MULTIPLIER = 2.0
    }

    private val json = Json { 
        ignoreUnknownKeys = true
        isLenient = true
    }
    
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var messageRef = 0
    private var joinRef: String? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS
    private var isConnecting = false
    private var shouldReconnect = true
    private var sessionId: String? = null

    /**
     * Connect to the WebSocket with the given session ID
     */
    fun connect(sessionId: String) {
        if (isConnecting || webSocket != null) {
            Log.d(TAG, "Already connected or connecting")
            return
        }

        this.sessionId = sessionId
        isConnecting = true

        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://")
        val url = "$wsUrl/socket/websocket"

        Log.i(TAG, "Connecting to WebSocket: $url")

        val request = Request.Builder()
            .url(url)
            .build()

        webSocket = client.newWebSocket(request, WebSocketHandler())
    }

    /**
     * Disconnect from the WebSocket
     */
    fun disconnect() {
        Log.i(TAG, "Disconnecting WebSocket")
        shouldReconnect = false
        stopHeartbeat()
        stopReconnect()
        webSocket?.close(1000, "Client disconnecting")
        webSocket = null
        isConnecting = false
        sessionId = null
        joinRef = null
    }

    /**
     * Send a device event to the backend
     */
    fun sendDeviceEvent(eventType: String, data: Map<String, String>) {
        val payload = buildJsonObject {
            put("event_type", eventType)
            // Convert map to JsonObject
            put("data", buildJsonObject {
                data.forEach { (key, value) ->
                    put(key, value)
                }
            })
        }
        sendMessage("device_event", payload)
    }

    private fun sendMessage(event: String, payload: JsonObject = buildJsonObject {}) {
        val topic = "device_rc:$deviceId"
        val ref = (++messageRef).toString()
        
        // Phoenix protocol uses array format: [join_ref, ref, topic, event, payload]
        val message = buildJsonArray {
            add(joinRef ?: "")
            add(ref)
            add(topic)
            add(event)
            add(payload)
        }

        try {
            val jsonString = json.encodeToString(JsonArray.serializer(), message)
            Log.d(TAG, "Sending message: $jsonString")
            webSocket?.send(jsonString)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending message", e)
        }
    }

    private fun joinChannel() {
        val sid = sessionId ?: run {
            Log.e(TAG, "Cannot join channel: sessionId is null")
            return
        }

        joinRef = (++messageRef).toString()
        
        val payload = buildJsonObject {
            put("token", deviceToken)
            put("session_id", sid)
        }
        sendMessage("phx_join", payload)
    }

    private fun startHeartbeat() {
        stopHeartbeat()
        heartbeatJob = coroutineScope.launch {
            while (isActive && webSocket != null) {
                sendMessage("phx_heartbeat", buildJsonObject {})
                delay(HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) return

        stopReconnect()
        reconnectJob = coroutineScope.launch {
            Log.i(TAG, "Reconnecting in ${currentReconnectDelay}ms")
            delay(currentReconnectDelay)

            if (isActive && shouldReconnect && sessionId != null) {
                currentReconnectDelay = minOf(
                    (currentReconnectDelay * RECONNECT_BACKOFF_MULTIPLIER).toLong(),
                    MAX_RECONNECT_DELAY_MS
                )
                connect(sessionId!!)
            }
        }
    }

    private fun stopReconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
    }

    /**
     * Handle control events received from the backend
     */
    private fun handleControlEvent(payload: JsonObject?) {
        if (payload == null) {
            Log.w(TAG, "Received null control event payload")
            return
        }

        try {
            val eventType = payload["event_type"]?.toString()?.trim('"')
            val data = payload["data"] as? JsonObject

            if (eventType == null || data == null) {
                Log.w(TAG, "Invalid control event format: $payload")
                return
            }

            val service = RemoteAccessibilityService.getInstance()
            if (service == null) {
                Log.w(TAG, "RemoteAccessibilityService not available, cannot inject gesture")
                return
            }

            when (eventType) {
                "tap" -> {
                    val x = data["x"]?.toString()?.toFloatOrNull()
                    val y = data["y"]?.toString()?.toFloatOrNull()
                    val duration = data["duration"]?.toString()?.toLongOrNull() ?: 100L

                    if (x != null && y != null) {
                        service.injectTap(x, y, duration)
                        Log.d(TAG, "Injected tap at ($x, $y)")
                    } else {
                        Log.w(TAG, "Invalid tap coordinates: x=$x, y=$y")
                    }
                }
                "long_press" -> {
                    val x = data["x"]?.toString()?.toFloatOrNull()
                    val y = data["y"]?.toString()?.toFloatOrNull()
                    val duration = data["duration"]?.toString()?.toLongOrNull() ?: 600L

                    if (x != null && y != null) {
                        service.injectLongPress(x, y, duration)
                        Log.d(TAG, "Injected long press at ($x, $y)")
                    } else {
                        Log.w(TAG, "Invalid long press coordinates: x=$x, y=$y")
                    }
                }
                "swipe" -> {
                    val startX = data["start_x"]?.toString()?.toFloatOrNull()
                    val startY = data["start_y"]?.toString()?.toFloatOrNull()
                    val endX = data["end_x"]?.toString()?.toFloatOrNull()
                    val endY = data["end_y"]?.toString()?.toFloatOrNull()
                    val duration = data["duration"]?.toString()?.toLongOrNull() ?: 300L

                    if (startX != null && startY != null && endX != null && endY != null) {
                        service.injectSwipe(startX, startY, endX, endY, duration)
                        Log.d(TAG, "Injected swipe from ($startX, $startY) to ($endX, $endY)")
                    } else {
                        Log.w(TAG, "Invalid swipe coordinates")
                    }
                }
                "multi_step" -> {
                    val pointsArray = data["points"] as? kotlinx.serialization.json.JsonArray
                    val duration = data["duration"]?.toString()?.toLongOrNull() ?: 500L

                    if (pointsArray != null) {
                        val points = mutableListOf<Pair<Float, Float>>()
                        for (pointElement in pointsArray) {
                            val pointObj = pointElement as? JsonObject
                            val x = pointObj?.get("x")?.toString()?.toFloatOrNull()
                            val y = pointObj?.get("y")?.toString()?.toFloatOrNull()
                            
                            if (x != null && y != null) {
                                points.add(Pair(x, y))
                            }
                        }

                        if (points.isNotEmpty()) {
                            service.injectMultiStepGesture(points, duration)
                            Log.d(TAG, "Injected multi-step gesture with ${points.size} points")
                        } else {
                            Log.w(TAG, "No valid points in multi-step gesture")
                        }
                    } else {
                        Log.w(TAG, "Invalid multi-step gesture format")
                    }
                }
                "global_action" -> {
                    val action = data["action"]?.toString()?.toIntOrNull()
                    
                    if (action != null) {
                        val success = service.performAction(action)
                        Log.d(TAG, "Performed global action $action: $success")
                    } else {
                        Log.w(TAG, "Invalid global action: ${data["action"]}")
                    }
                }
                "init_mapper" -> {
                    val rcWidth = data["rc_width"]?.toString()?.toIntOrNull()
                    val rcHeight = data["rc_height"]?.toString()?.toIntOrNull()
                    
                    if (rcWidth != null && rcHeight != null) {
                        service.initializeGestureMapper(rcWidth, rcHeight)
                        Log.i(TAG, "Initialized gesture mapper: ${rcWidth}x${rcHeight}")
                    } else {
                        Log.w(TAG, "Invalid mapper dimensions: width=$rcWidth, height=$rcHeight")
                    }
                }
                else -> {
                    Log.w(TAG, "Unknown control event type: $eventType")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling control event", e)
        }
    }

    private inner class WebSocketHandler : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.i(TAG, "WebSocket connected")
            isConnecting = false
            currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS
            joinChannel()
            startHeartbeat()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "Received message: $text")

            try {
                // Phoenix protocol: [join_ref, ref, topic, event, payload]
                val array = json.decodeFromString<JsonArray>(text)
                
                if (array.size >= 5) {
                    val event = array[3].toString().trim('"')
                    val payload = array[4]

                    when (event) {
                        "phx_reply" -> {
                            Log.d(TAG, "Received reply: $payload")
                            val payloadObj = payload as? JsonObject
                            val status = payloadObj?.get("status")?.toString()?.trim('"')
                            
                            if (status == "ok") {
                                Log.i(TAG, "Successfully joined channel")
                            } else {
                                Log.e(TAG, "Failed to join channel: $payload")
                            }
                        }
                        "control_event" -> {
                            // Handle control events from the backend
                            Log.d(TAG, "Received control event: $payload")
                            handleControlEvent(payload as? JsonObject)
                        }
                        "session_stopped" -> {
                            Log.i(TAG, "Session stopped by backend")
                            disconnect()
                        }
                        else -> {
                            Log.d(TAG, "Unhandled event: $event")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing message", e)
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure: ${t.message}", t)
            isConnecting = false
            stopHeartbeat()
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.i(TAG, "WebSocket closed: $code - $reason")
            isConnecting = false
            stopHeartbeat()
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }
    }
}
