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
                            // TODO: Forward to RemoteAccessibilityService
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
