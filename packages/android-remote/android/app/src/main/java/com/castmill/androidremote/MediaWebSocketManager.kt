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
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
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
     * Connect to the media WebSocket
     */
    fun connect() {
        if (isConnecting || webSocket != null) {
            Log.d(TAG, "Already connected or connecting to media channel")
            return
        }

        isConnecting = true

        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://")
        val url = "$wsUrl/socket/websocket"

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
     * Send a video frame as binary WebSocket message
     */
    fun sendVideoFrame(buffer: ByteBuffer, isKeyFrame: Boolean, codecType: String) {
        if (!isJoined) {
            Log.w(TAG, "Not joined to media channel, dropping frame")
            return
        }

        try {
            // Create metadata header (JSON) + binary frame
            // Format: [metadata_length (4 bytes)][metadata JSON][NAL unit data]
            val metadata = buildJsonObject {
                put("type", "video_frame")
                put("codec", codecType)
                put("is_key_frame", isKeyFrame)
                put("timestamp", System.currentTimeMillis())
                put("size", buffer.remaining())
            }
            
            val metadataBytes = json.encodeToString(JsonObject.serializer(), metadata).toByteArray()
            val metadataLength = metadataBytes.size
            
            // Create combined buffer with metadata length prefix
            val totalSize = 4 + metadataLength + buffer.remaining()
            val combinedBuffer = ByteBuffer.allocate(totalSize)
            
            // Write metadata length (4 bytes, big-endian)
            combinedBuffer.putInt(metadataLength)
            
            // Write metadata
            combinedBuffer.put(metadataBytes)
            
            // Write frame data - use duplicate to avoid mutating input buffer
            val bufferCopy = buffer.duplicate()
            bufferCopy.rewind()
            combinedBuffer.put(bufferCopy)
            
            // Send as binary WebSocket message
            combinedBuffer.rewind()
            val byteArray = ByteArray(combinedBuffer.remaining())
            combinedBuffer.get(byteArray)
            
            // Use local reference to avoid race condition
            val ws = webSocket
            if (ws == null) {
                Log.w(TAG, "WebSocket not connected, dropping video frame")
                return
            }
            // Use extension function for ByteString conversion
            ws.send(byteArray.toByteString(0, byteArray.size))
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
        
        // Phoenix protocol uses array format: [join_ref, ref, topic, event, payload]
        val message = buildJsonArray {
            add(JsonPrimitive(joinRef ?: ""))
            add(JsonPrimitive(ref))
            add(JsonPrimitive(topic))
            add(JsonPrimitive(event))
            add(payload)
        }

        try {
            val jsonString = json.encodeToString(JsonArray.serializer(), message)
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
            diagnosticsManager?.recordNetworkError()
            stopHeartbeat()
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.i(TAG, "Media WebSocket closed: $code - $reason")
            isConnecting = false
            isWebSocketOpen = false
            isJoined = false
            stopHeartbeat()
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }
    }
}
