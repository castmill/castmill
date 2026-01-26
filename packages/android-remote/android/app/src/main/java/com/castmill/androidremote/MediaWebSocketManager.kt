package com.castmill.androidremote

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit

/**
 * MediaWebSocketManager handles the WebSocket connection for media streaming
 * on the device_media channel.
 * 
 * This manager:
 * - Connects to device_media:#{device_id}:#{session_id} channel
 * - Handles Phoenix channel protocol for media channel
 * - Streams video frames as binary WebSocket messages
 * - Implements automatic reconnection with exponential backoff
 * - Manages message serialization/deserialization
 */
class MediaWebSocketManager(
    private val baseUrl: String,
    private val deviceId: String,
    private val deviceToken: String,
    private val sessionId: String,
    private val coroutineScope: CoroutineScope,
    private val diagnosticsManager: DiagnosticsManager? = null,
    private val certificatePins: Map<String, List<String>>? = null
) {
    companion object {
        private const val TAG = "MediaWebSocketManager"
        private const val HEARTBEAT_INTERVAL_MS = 30000L // 30 seconds
        private const val INITIAL_RECONNECT_DELAY_MS = 1000L // 1 second
        private const val MAX_RECONNECT_DELAY_MS = 60000L // 1 minute
        private const val RECONNECT_BACKOFF_MULTIPLIER = 2.0
    }

    private val json = Json { 
        ignoreUnknownKeys = true
        isLenient = true
    }
    
    private val client = buildOkHttpClient()

    private var webSocket: WebSocket? = null
    private var messageRef = 0
    private var joinRef: String? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS
    private var isConnecting = false
    private var isWebSocketOpen = false
    private var shouldReconnect = true
    private var isJoined = false

    /**
     * Connect to the media WebSocket.
     * The device_media channel is on the RcSocket at /ws endpoint.
     */
    fun connect() {
        if (isConnecting || webSocket != null) {
            Log.d(TAG, "Already connected or connecting to media channel")
            return
        }

        isConnecting = true

        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://")
        // Use /ws/websocket - device_media channel is on RcSocket, not DeviceSocket
        val url = "$wsUrl/ws/websocket"

        Log.i(TAG, "Connecting to Media WebSocket: $url for session: $sessionId")

        val request = Request.Builder()
            .url(url)
            .addHeader("X-Device-ID", deviceId)
            .addHeader("X-Device-Token", deviceToken)
            .build()

        webSocket = client.newWebSocket(request, WebSocketHandler())
        diagnosticsManager?.recordConnectionStart()
    }
    
    /**
     * Build OkHttpClient with security configurations
     */
    private fun buildOkHttpClient(): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .pingInterval(30, TimeUnit.SECONDS)
        
        // Configure certificate pinning if pins are provided
        certificatePins?.let { pins ->
            val certificatePinnerBuilder = okhttp3.CertificatePinner.Builder()
            pins.forEach { (hostname, pinList) ->
                pinList.forEach { pin ->
                    certificatePinnerBuilder.add(hostname, "sha256/$pin")
                }
            }
            builder.certificatePinner(certificatePinnerBuilder.build())
            Log.i(TAG, "Certificate pinning enabled for ${pins.keys.size} hostname(s)")
        }
        
        return builder.build()
    }

    /**
     * Disconnect from the media WebSocket
     */
    fun disconnect() {
        Log.i(TAG, "Disconnecting Media WebSocket")
        shouldReconnect = false
        isJoined = false
        isWebSocketOpen = false
        stopHeartbeat()
        stopReconnect()
        webSocket?.close(1000, "Client disconnecting")
        webSocket = null
        isConnecting = false
        joinRef = null
        
        // Shut down the OkHttpClient to release resources
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
        
        diagnosticsManager?.recordDisconnection()
    }

    /**
     * Send a video frame as a Phoenix channel event.
     * Phoenix channels require JSON messages, so we Base64 encode the binary frame data.
     */
    fun sendVideoFrame(buffer: ByteBuffer, isKeyFrame: Boolean, codecType: String) {
        if (!isJoined) {
            Log.w(TAG, "Not joined to media channel, dropping frame")
            return
        }

        try {
            // Extract frame data as byte array
            val bufferCopy = buffer.duplicate()
            bufferCopy.rewind()
            val frameData = ByteArray(bufferCopy.remaining())
            bufferCopy.get(frameData)
            
            // Base64 encode the frame data for JSON transport
            val base64Data = android.util.Base64.encodeToString(frameData, android.util.Base64.NO_WRAP)
            
            // Create payload for Phoenix channel event
            // Use "frame_type" with "idr" or "p" as expected by backend schema
            val frameType = if (isKeyFrame) "idr" else "p"
            val payload = buildJsonObject {
                put("data", base64Data)
                put("frame_type", frameType)
                put("codec", codecType)
                put("timestamp", System.currentTimeMillis())
                put("size", frameData.size)
            }
            
            // Send as a Phoenix channel event
            sendMessage("media_frame", payload)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending video frame", e)
        }
    }

    /**
     * Send media metadata (resolution, fps, etc.)
     */
    fun sendMediaMetadata(width: Int, height: Int, fps: Int, codec: String) {
        val payload = buildJsonObject {
            put("width", width)
            put("height", height)
            put("fps", fps)
            put("codec", codec)
        }
        sendMessage("media_metadata", payload)
    }

    private fun sendMessage(event: String, payload: JsonObject = buildJsonObject {}) {
        if (!isWebSocketOpen && event != "phx_join") {
            Log.w(TAG, "WebSocket not connected, cannot send $event message")
            return
        }
        
        val topic = "device_media:$deviceId:$sessionId"
        val ref = (++messageRef).toString()
        
        // Phoenix V1 JSON protocol uses object format: {topic, event, payload, ref, join_ref}
        val message = buildJsonObject {
            put("topic", topic)
            put("event", event)
            put("payload", payload)
            put("ref", ref)
            joinRef?.let { put("join_ref", it) }
        }

        try {
            val jsonString = json.encodeToString(JsonObject.serializer(), message)
            Log.d(TAG, "Sending message: $jsonString")
            webSocket?.send(jsonString)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending message", e)
            diagnosticsManager?.recordNetworkError()
        }
    }

    private fun joinChannel() {
        joinRef = (++messageRef).toString()
        
        val payload = buildJsonObject {
            put("token", deviceToken)
        }
        sendMessage("phx_join", payload)
    }

    private fun startHeartbeat() {
        stopHeartbeat()
        heartbeatJob = coroutineScope.launch {
            while (isActive && webSocket != null) {
                sendMessage("phx_heartbeat", buildJsonObject {})
                diagnosticsManager?.recordHeartbeat()
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

        diagnosticsManager?.recordReconnectAttempt()
        stopReconnect()
        reconnectJob = coroutineScope.launch {
            Log.i(TAG, "Reconnecting in ${currentReconnectDelay}ms")
            delay(currentReconnectDelay)

            if (isActive && shouldReconnect) {
                currentReconnectDelay = minOf(
                    (currentReconnectDelay * RECONNECT_BACKOFF_MULTIPLIER).toLong(),
                    MAX_RECONNECT_DELAY_MS
                )
                connect()
            }
        }
    }

    private fun stopReconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
    }

    private inner class WebSocketHandler : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.i(TAG, "Media WebSocket connected")
            isConnecting = false
            isWebSocketOpen = true
            currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS
            
            joinChannel()
            startHeartbeat()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "Received message: $text")

            try {
                // Phoenix V1 JSON protocol: {topic, event, payload, ref, join_ref}
                val message = json.decodeFromString<JsonObject>(text)
                
                val event = message["event"]?.toString()?.trim('"') ?: return
                val payload = message["payload"]

                when (event) {
                    "phx_reply" -> {
                        Log.d(TAG, "Received reply: $payload")
                        val payloadObj = payload as? JsonObject
                        val status = payloadObj?.get("status")?.toString()?.trim('"')
                        
                        if (status == "ok") {
                            Log.i(TAG, "Successfully joined media channel")
                            isJoined = true
                            diagnosticsManager?.recordSuccessfulReconnect()
                        } else {
                            Log.e(TAG, "Failed to join media channel: $payload")
                            isJoined = false
                            // Authentication failed - disconnect and don't retry automatically
                            shouldReconnect = false
                            disconnect()
                        }
                    }
                    "session_stopped" -> {
                        Log.i(TAG, "Session stopped by backend")
                        disconnect()
                    }
                    else -> {
                        Log.d(TAG, "Unhandled event: $event")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing message", e)
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "Media WebSocket failure: ${t.message}", t)
            isConnecting = false
            isWebSocketOpen = false
            isJoined = false
            this@MediaWebSocketManager.webSocket = null  // Clear reference so connect() will work
            diagnosticsManager?.recordNetworkError()
            stopHeartbeat()
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.i(TAG, "Media WebSocket closed: $code - $reason")
            isConnecting = false
            isWebSocketOpen = false
            isJoined = false
            this@MediaWebSocketManager.webSocket = null  // Clear reference so connect() will work
            stopHeartbeat()
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }
    }
}
