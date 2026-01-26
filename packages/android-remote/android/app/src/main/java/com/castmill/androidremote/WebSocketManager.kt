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
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

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
 * 
 * Modes:
 * - Standby mode: Only requires deviceId (hardware_id), sends heartbeats
 * - Session mode: Requires deviceId, deviceToken, and sessionId for full RC
 */

/**
 * Data class containing start_session event data
 */
data class StartSessionData(
    val sessionId: String,
    val sessionToken: String?,
    val deviceId: String?
)

class WebSocketManager(
    private val baseUrl: String,
    private val deviceId: String,
    private val deviceToken: String = "", // Optional for standby mode
    private val coroutineScope: CoroutineScope,
    private val diagnosticsManager: DiagnosticsManager? = null,
    private val certificatePins: Map<String, List<String>>? = null, // hostname -> list of SHA-256 pins
    private val onStartSession: ((StartSessionData) -> Unit)? = null, // Callback when start_session is received
    private val onSessionStopped: (() -> Unit)? = null // Callback when session is stopped (window closed, etc.)
) {
    companion object {
        private const val TAG = "WebSocketManager"
        private const val HEARTBEAT_INTERVAL_MS = 30000L // 30 seconds (Phoenix protocol heartbeat)
        private const val RC_HEARTBEAT_INTERVAL_MS = 15000L // 15 seconds (RC app availability heartbeat)
        private const val INITIAL_RECONNECT_DELAY_MS = 1000L // 1 second
        private const val MAX_RECONNECT_DELAY_MS = 60000L // 1 minute
        private const val RECONNECT_BACKOFF_MULTIPLIER = 2.0
        private const val DIAGNOSTICS_REPORT_INTERVAL_MS = 10000L // 10 seconds
    }

    private val json = Json { 
        ignoreUnknownKeys = true
        isLenient = true
    }
    
    private val client = buildOkHttpClient()

    private var webSocket: WebSocket? = null
    private var messageRef = 0
    private var joinRef: String? = null
    private var joinMessageRef: String? = null  // Track the actual ref used for join message
    private var heartbeatJob: Job? = null
    private var diagnosticsJob: Job? = null
    private var reconnectJob: Job? = null
    private var currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS
    private var isConnecting = false
    private var isWebSocketOpen = false  // Track websocket connection state
    private var shouldReconnect = true
    private var sessionId: String? = null
    private var isAuthenticated = false
    private var isStandbyMode = false
    private var rcHeartbeatJob: Job? = null

    /**
     * Connect to the WebSocket in standby mode (no active session).
     * In standby mode, the app just sends RC heartbeats to indicate it's available.
     */
    fun connectStandby() {
        if (isConnecting || webSocket != null) {
            Log.d(TAG, "Already connected or connecting")
            return
        }

        this.sessionId = null
        this.isStandbyMode = true
        connectInternal()
    }

    /**
     * Connect to the WebSocket with the given session ID
     */
    fun connect(sessionId: String) {
        if (isConnecting || webSocket != null) {
            Log.d(TAG, "Already connected or connecting")
            return
        }

        this.sessionId = sessionId
        this.isStandbyMode = false
        connectInternal()
    }

    private fun connectInternal() {
        isConnecting = true

        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://")
        val url = "$wsUrl/ws/websocket"

        Log.i(TAG, "Connecting to WebSocket: $url")

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
            val certificatePinnerBuilder = CertificatePinner.Builder()
            pins.forEach { (hostname, pinList) ->
                pinList.forEach { pin ->
                    certificatePinnerBuilder.add(hostname, "sha256/$pin")
                }
            }
            builder.certificatePinner(certificatePinnerBuilder.build())
            Log.i(TAG, "Certificate pinning enabled for ${pins.keys.size} hostname(s)")
        }
        
        // Use default SSL context for TLS certificate validation
        // Android's default TrustManager validates the certificate chain
        // No custom TrustManager needed - rely on system's certificate store
        
        return builder.build()
    }

    /**
     * Disconnect from the WebSocket
     */
    fun disconnect() {
        Log.i(TAG, "Disconnecting WebSocket")
        shouldReconnect = false
        isAuthenticated = false
        isWebSocketOpen = false
        stopHeartbeat()
        stopRcHeartbeat()
        stopDiagnosticsReporting()
        stopReconnect()
        webSocket?.close(1000, "Client disconnecting")
        webSocket = null
        isConnecting = false
        sessionId = null
        joinRef = null
        isStandbyMode = false
        diagnosticsManager?.recordDisconnection()
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

    /**
     * Send a video frame to the backend as binary WebSocket frame
     */
    fun sendVideoFrame(buffer: java.nio.ByteBuffer, isKeyFrame: Boolean, codecType: String) {
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
            val combinedBuffer = java.nio.ByteBuffer.allocate(totalSize)
            
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
            
            // Use local reference to avoid smart cast issue
            val ws = webSocket
            if (ws == null) {
                Log.w(TAG, "WebSocket not connected, dropping video frame: size=${byteArray.size}, codec=$codecType, isKeyFrame=$isKeyFrame")
                return
            }
            ws.send(byteArray.toByteString())
        } catch (e: Exception) {
            Log.e(TAG, "Error sending video frame", e)
        }
    }

    /**
     * Send diagnostics report to the backend
     */
    fun sendDiagnosticsReport() {
        if (!isAuthenticated) {
            Log.d(TAG, "Not authenticated, skipping diagnostics report")
            return
        }
        
        diagnosticsManager?.let { diag ->
            val report = diag.getDiagnosticsReport()
            sendMessage("stats_report", report)
            Log.d(TAG, "Sent diagnostics report: FPS=${diag.getCurrentFps()}, Bitrate=${diag.getCurrentBitrate() / 1_000_000}Mbps")
        }
    }

    private fun sendMessage(event: String, payload: JsonObject = buildJsonObject {}) {
        if (!isWebSocketOpen && event != "phx_join") {
            Log.w(TAG, "WebSocket not connected, cannot send $event message")
            return
        }
        
        val topic = "device_rc:$deviceId"
        val ref = (++messageRef).toString()
        
        // Phoenix V1 protocol uses JSON object format
        val message = buildJsonObject {
            put("topic", topic)
            put("event", event)
            put("payload", payload)
            put("ref", ref)
            if (joinRef != null) {
                put("join_ref", joinRef)
            }
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
        
        val payload = if (isStandbyMode) {
            // Standby mode - just hardware_id (device_id), no token needed
            buildJsonObject {
                put("hardware_id", deviceId)
            }
        } else {
            val sid = sessionId ?: run {
                Log.e(TAG, "Cannot join channel: sessionId is null")
                return
            }
            buildJsonObject {
                put("token", deviceToken)
                put("session_id", sid)
            }
        }
        // Track the ref that will be used for the join message
        // sendMessage will increment messageRef, so the join message ref will be messageRef + 1
        joinMessageRef = (messageRef + 1).toString()
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

    /**
     * Start sending RC heartbeats to indicate the RC app is available.
     * This is separate from Phoenix protocol heartbeats.
     */
    private fun startRcHeartbeat() {
        stopRcHeartbeat()
        rcHeartbeatJob = coroutineScope.launch {
            // Send initial heartbeat immediately
            sendMessage("rc_heartbeat", buildJsonObject {})
            Log.d(TAG, "Sent initial RC heartbeat")
            
            while (isActive && webSocket != null && isAuthenticated) {
                delay(RC_HEARTBEAT_INTERVAL_MS)
                sendMessage("rc_heartbeat", buildJsonObject {})
                Log.d(TAG, "Sent RC heartbeat")
            }
        }
    }

    private fun stopRcHeartbeat() {
        rcHeartbeatJob?.cancel()
        rcHeartbeatJob = null
    }
    
    private fun startDiagnosticsReporting() {
        stopDiagnosticsReporting()
        diagnosticsJob = coroutineScope.launch {
            while (isActive && webSocket != null && isAuthenticated) {
                delay(DIAGNOSTICS_REPORT_INTERVAL_MS)
                sendDiagnosticsReport()
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }
    
    private fun stopDiagnosticsReporting() {
        diagnosticsJob?.cancel()
        diagnosticsJob = null
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) {
            Log.d(TAG, "Reconnect skipped: shouldReconnect=false")
            return
        }

        diagnosticsManager?.recordReconnectAttempt()
        stopReconnect()
        reconnectJob = coroutineScope.launch {
            Log.i(TAG, "Reconnecting in ${currentReconnectDelay}ms (isStandbyMode=$isStandbyMode, sessionId=$sessionId)")
            delay(currentReconnectDelay)

            if (isActive && shouldReconnect) {
                currentReconnectDelay = minOf(
                    (currentReconnectDelay * RECONNECT_BACKOFF_MULTIPLIER).toLong(),
                    MAX_RECONNECT_DELAY_MS
                )
                if (isStandbyMode) {
                    Log.i(TAG, "Reconnecting in standby mode")
                    connectStandby()
                } else if (sessionId != null) {
                    Log.i(TAG, "Reconnecting with session: $sessionId")
                    connect(sessionId!!)
                } else {
                    Log.w(TAG, "Cannot reconnect: not in standby mode and no sessionId")
                }
            }
        }
    }

    private fun stopReconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
    }

    /**
     * Handle start_session event from the backend
     */
    private fun handleStartSession(payload: JsonObject?) {
        if (payload == null) {
            Log.w(TAG, "Received null start_session payload")
            return
        }

        try {
            // Extract session ID from payload if available, fallback to stored sessionId
            val sid = payload["session_id"]?.toString()?.trim('"') ?: sessionId
            if (sid == null) {
                Log.e(TAG, "Cannot handle start_session: no session ID in payload or stored")
                return
            }

            // Extract session token and device ID from payload (sent by server for authentication)
            val sessionToken = payload["session_token"]?.toString()?.trim('"')
            val deviceIdFromPayload = payload["device_id"]?.toString()?.trim('"')

            Log.i(TAG, "Handling start_session for session: $sid, hasToken=${sessionToken != null}, deviceId=$deviceIdFromPayload")
            
            // Notify the service to initialize MediaProjection and start encoding
            val startSessionData = StartSessionData(
                sessionId = sid,
                sessionToken = sessionToken,
                deviceId = deviceIdFromPayload
            )
            onStartSession?.invoke(startSessionData)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling start_session event", e)
        }
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
                "key" -> {
                    val action = data["action"]?.toString()?.trim('"')
                    val key = data["key"]?.toString()?.trim('"') ?: ""
                    val code = data["code"]?.toString()?.trim('"') ?: ""
                    val shift = data["shift"]?.toString()?.toBooleanStrictOrNull() ?: false
                    val ctrl = data["ctrl"]?.toString()?.toBooleanStrictOrNull() ?: false
                    val alt = data["alt"]?.toString()?.toBooleanStrictOrNull() ?: false
                    val meta = data["meta"]?.toString()?.toBooleanStrictOrNull() ?: false
                    
                    if (action != null) {
                        service.injectKey(action, key, code, shift, ctrl, alt, meta)
                        Log.d(TAG, "Injected key event: action=$action, key=$key, code=$code")
                    } else {
                        Log.w(TAG, "Invalid key event: missing action")
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
            isWebSocketOpen = true
            currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS
            
            // Verify TLS connection for WSS
            if (baseUrl.startsWith("https://")) {
                response.handshake?.let { handshake ->
                    val peerCertificates = handshake.peerCertificates
                    if (peerCertificates.isNotEmpty()) {
                        Log.i(TAG, "TLS connection established with ${peerCertificates.size} certificate(s)")
                        peerCertificates.forEachIndexed { index, cert ->
                            if (cert is X509Certificate) {
                                Log.d(TAG, "Certificate $index: Subject=${cert.subjectDN}, Issuer=${cert.issuerDN}")
                            }
                        }
                    } else {
                        Log.w(TAG, "No peer certificates found in handshake")
                    }
                } ?: Log.w(TAG, "No handshake information available")
            }
            
            joinChannel()
            startHeartbeat()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "Received message: $text")

            try {
                // Phoenix V1 protocol uses JSON object format
                val message = json.decodeFromString<JsonObject>(text)
                
                val event = message["event"]?.toString()?.trim('"') ?: return
                val payload = message["payload"] as? JsonObject

                when (event) {
                    "phx_reply" -> {
                        Log.d(TAG, "Received reply: $payload")
                        val status = payload?.get("status")?.toString()?.trim('"')
                        val response = payload?.get("response") as? JsonObject
                        val replyRef = message["ref"]?.toString()?.trim('"')
                        
                        // Only process join reply (ref matches joinMessageRef), not heartbeat replies
                        if (status == "ok" && replyRef == joinMessageRef) {
                            Log.i(TAG, "Successfully joined channel and authenticated")
                            isAuthenticated = true
                            diagnosticsManager?.recordSuccessfulReconnect()
                            startDiagnosticsReporting()
                            // Start RC heartbeat to indicate the app is available
                            startRcHeartbeat()
                            // Clear joinMessageRef so we don't trigger again
                            joinMessageRef = null
                        } else if (status != "ok" && replyRef == joinMessageRef) {
                            Log.e(TAG, "Failed to join channel: $payload")
                            isAuthenticated = false
                            // Authentication failed - disconnect and don't retry automatically
                            shouldReconnect = false
                            disconnect()
                        } else if (status == "error") {
                            // Check for "unmatched topic" error - this means we need to rejoin
                            val reason = response?.get("reason")?.toString()?.trim('"')
                            if (reason == "unmatched topic") {
                                Log.w(TAG, "Channel disconnected (unmatched topic), triggering rejoin")
                                isAuthenticated = false
                                // Trigger rejoin by re-sending the join message
                                joinChannel()
                            }
                        }
                        // Ignore OK replies for heartbeats and other messages
                    }
                    "control_event" -> {
                        // Handle control events from the backend
                        Log.d(TAG, "Received control event: $payload")
                        handleControlEvent(payload)
                    }
                    "start_session" -> {
                        // Session started by backend - trigger media capture
                        Log.i(TAG, "Received start_session event")
                        handleStartSession(payload)
                    }
                    "session_stopped" -> {
                        Log.i(TAG, "Session stopped by backend (RC window closed)")
                        // Notify service to stop screen capture
                        onSessionStopped?.invoke()
                        // Go back to standby mode - don't disconnect, just stop the session
                        sessionId = null
                        isStandbyMode = true
                        Log.i(TAG, "Returning to standby mode")
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
            Log.e(TAG, "WebSocket failure: ${t.message}", t)
            isConnecting = false
            isWebSocketOpen = false
            isAuthenticated = false
            // Clear the webSocket reference so reconnect can create a new one
            this@WebSocketManager.webSocket = null
            // Reset join refs for clean rejoin on reconnect
            joinRef = null
            joinMessageRef = null
            diagnosticsManager?.recordNetworkError()
            stopHeartbeat()
            stopRcHeartbeat()
            stopDiagnosticsReporting()
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.i(TAG, "WebSocket closed: $code - $reason")
            isConnecting = false
            isWebSocketOpen = false
            isAuthenticated = false
            // Clear the webSocket reference so reconnect can create a new one
            this@WebSocketManager.webSocket = null
            // Reset join refs for clean rejoin on reconnect
            joinRef = null
            joinMessageRef = null
            stopHeartbeat()
            stopRcHeartbeat()
            stopDiagnosticsReporting()
            if (shouldReconnect) {
                scheduleReconnect()
            }
        }
    }
}
