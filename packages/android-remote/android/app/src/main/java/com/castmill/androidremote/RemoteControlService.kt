package com.castmill.androidremote

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * RemoteControlService
 * 
 * Foreground service that manages:
 * - WebSocket connection for remote control
 * - Screen capture via MediaProjection (future)
 * - Screen encoding via MediaCodec (future)
 * - Communication with RemoteAccessibilityService for input injection
 */
class RemoteControlService : LifecycleService() {

    companion object {
        private const val TAG = "RemoteControlService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "castmill_remote_control"
        private const val CHANNEL_NAME = "Castmill Remote Control"
        
        // Intent actions
        const val ACTION_UPDATE_MEDIA_PROJECTION = "com.castmill.androidremote.UPDATE_MEDIA_PROJECTION"
        
        // Intent extras
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_DEVICE_TOKEN = "device_token"
        const val EXTRA_MEDIA_PROJECTION_RESULT_CODE = "media_projection_result_code"
        const val EXTRA_MEDIA_PROJECTION_DATA = "media_projection_data"
        
        // SharedPreferences
        private const val PREFS_NAME = "castmill_remote_prefs"
        private const val PREF_DEVICE_TOKEN = "device_token"
    }

    private var screenCaptureManager: ScreenCaptureManager? = null
    private var webSocketManager: WebSocketManager? = null
    private var mediaWebSocketManager: MediaWebSocketManager? = null
    private var diagnosticsManager: DiagnosticsManager? = null
    private var deviceId: String? = null
    private var sessionId: String? = null // Current session ID
    private var isConnected = false
    private var isCapturing = false
    private var pendingSessionId: String? = null // Track session waiting for MediaProjection
    private var pendingSessionToken: String? = null // Session token from start_session (for media auth)
    private var pendingDeviceId: String? = null // Device ID from start_session
    
    // Store MediaProjection permission data for later use
    // Note: Activity.RESULT_OK = -1, so we use a boolean flag instead of checking resultCode
    private var hasMediaProjectionPermission = false
    private var mediaProjectionResultCode: Int = Activity.RESULT_CANCELED
    private var mediaProjectionData: Intent? = null

    override fun onCreate() {
        super.onCreate()
        
        // Compute device ID
        deviceId = DeviceUtils.getDeviceId(this)
        
        // Initialize diagnostics manager
        diagnosticsManager = DiagnosticsManager()
        
        createNotificationChannel()
        
        // Start with SPECIAL_USE type since mediaProjection requires user consent first on Android 14+
        // We'll upgrade to mediaProjection type when we have permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                createNotification("Initializing..."),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, createNotification("Initializing..."))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        
        // Check if this is an action to update MediaProjection permission
        if (intent?.action == ACTION_UPDATE_MEDIA_PROJECTION) {
            val resultCode = intent.getIntExtra(EXTRA_MEDIA_PROJECTION_RESULT_CODE, Activity.RESULT_CANCELED)
            val projectionData = intent.getParcelableExtra<Intent>(EXTRA_MEDIA_PROJECTION_DATA)
            
            // Activity.RESULT_OK = -1, so we check for that specifically
            if (resultCode == Activity.RESULT_OK && projectionData != null) {
                Log.i(TAG, "Received MediaProjection permission update (resultCode=$resultCode)")
                hasMediaProjectionPermission = true
                mediaProjectionResultCode = resultCode
                mediaProjectionData = projectionData
                updateNotification("Screen capture ready - waiting for session")
                
                // If we have a pending session, start capture now
                if (pendingSessionId != null) {
                    Log.i(TAG, "Starting delayed capture for pending session: $pendingSessionId")
                    startMediaCapture(resultCode, projectionData, pendingSessionId!!)
                    pendingSessionId = null
                }
            }
            return START_STICKY
        }
        
        // Get session ID and device token from intent
        val sid = intent?.getStringExtra(EXTRA_SESSION_ID)
        val deviceToken: String? = intent?.getStringExtra(EXTRA_DEVICE_TOKEN)
            ?: getStoredDeviceToken()
        
        // Check if this is a standby mode request (no session ID)
        // Standby mode only needs deviceId (hardware_id) - no token required
        val isStandbyMode = sid == null && deviceId != null
        
        if (isStandbyMode) {
            // Standby mode - connect to send heartbeats only
            // Only deviceId (hardware_id) is needed - no token required
            Log.i(TAG, "Starting in standby mode (sending heartbeats)")
            
            // Store device token for future use if provided (for session mode later)
            if (intent?.hasExtra(EXTRA_DEVICE_TOKEN) == true && deviceToken != null) {
                storeDeviceToken(deviceToken)
            }
            
            // Initialize and connect WebSocket in standby mode
            lifecycleScope.launch {
                connectWebSocketStandby()
            }
        } else if (sid != null && deviceToken != null && deviceId != null) {
            // Session mode - requires session ID and token
            sessionId = sid
            
            // Store device token for future use
            if (intent?.hasExtra(EXTRA_DEVICE_TOKEN) == true) {
                storeDeviceToken(deviceToken)
            }
            
            // Initialize and connect WebSocket
            lifecycleScope.launch {
                connectWebSocket(sid, deviceToken)
            }
            
            // Check if MediaProjection permission is provided
            val resultCode = intent?.getIntExtra(EXTRA_MEDIA_PROJECTION_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
            val projectionData = intent?.getParcelableExtra<Intent>(EXTRA_MEDIA_PROJECTION_DATA)
            
            // Activity.RESULT_OK = -1, so check for that specifically
            if (resultCode == Activity.RESULT_OK && projectionData != null) {
                // Store MediaProjection permission for later use
                hasMediaProjectionPermission = true
                mediaProjectionResultCode = resultCode
                mediaProjectionData = projectionData
                
                // Start screen capture immediately if we have permission
                startScreenCapture(resultCode, projectionData)
            }
        } else {
            Log.e(TAG, "Missing required parameters: sessionId=$sid, token=${deviceToken != null}, deviceId=$deviceId")
            updateNotification("Error: Missing configuration")
        }
        
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        
        Log.i(TAG, "Service being destroyed, releasing all resources")
        
        // Clean up resources
        webSocketManager?.disconnect()
        webSocketManager = null
        
        mediaWebSocketManager?.disconnect()
        mediaWebSocketManager = null
        
        // Full stop - release MediaProjection completely
        screenCaptureManager?.stop()
        screenCaptureManager = null
        
        // Invalidate MediaProjection permission since service is being destroyed
        hasMediaProjectionPermission = false
        mediaProjectionResultCode = Activity.RESULT_CANCELED
        mediaProjectionData = null
        
        isConnected = false
        isCapturing = false
        
        Log.i(TAG, "Service destroyed, MediaProjection permission invalidated")
    }

    /**
     * Connect to the backend WebSocket in standby mode (no active session).
     * In this mode, we only send heartbeats to indicate the RC app is available.
     * Only requires deviceId (hardware_id) - no token needed for standby.
     */
    private fun connectWebSocketStandby() {
        val backendUrl = getString(R.string.backend_url)
        val mainHandler = Handler(Looper.getMainLooper())
        
        webSocketManager = WebSocketManager(
            baseUrl = backendUrl,
            deviceId = deviceId!!,
            // No token needed for standby mode - server verifies by hardware_id
            coroutineScope = lifecycleScope,
            diagnosticsManager = diagnosticsManager,
            certificatePins = null,
            onStartSession = { startSessionData ->
                // Backend requested to start session - initiate media capture
                // Must run on main thread for MediaProjection APIs
                mainHandler.post {
                    handleStartSessionRequest(startSessionData)
                }
            },
            onSessionStopped = {
                // Backend notified that session was stopped (RC window closed)
                // Stop screen capture and return to standby mode
                mainHandler.post {
                    handleSessionStopped()
                }
            }
        )
        
        webSocketManager?.connectStandby()
        isConnected = true
        updateNotification("Standby - waiting for RC session")
    }

    /**
     * Connect to the backend WebSocket
     */
    private fun connectWebSocket(sessionId: String, deviceToken: String) {
        val backendUrl = getString(R.string.backend_url)
        val mainHandler = Handler(Looper.getMainLooper())
        
        // Certificate pinning configuration (optional)
        // Uncomment and configure for production deployment
        // val certificatePins = mapOf(
        //     "api.castmill.io" to listOf(
        //         "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=", // Example: Current cert (replace with actual SHA-256 pin)
        //         "AfMENBVvOS8MnISprtvyPsjKlPooqh8nMB/pvCrpJpw="  // Example: Backup cert (replace with actual SHA-256 pin)
        //     )
        // )
        
        webSocketManager = WebSocketManager(
            baseUrl = backendUrl,
            deviceId = deviceId!!,
            deviceToken = deviceToken,
            coroutineScope = lifecycleScope,
            diagnosticsManager = diagnosticsManager,
            certificatePins = null, // Set to certificatePins map to enable pinning
            onStartSession = { sid ->
                // Backend requested to start session - initiate media capture
                mainHandler.post {
                    handleStartSessionRequest(sid)
                }
            },
            onSessionStopped = {
                // Backend notified that session was stopped (RC window closed)
                // Stop screen capture and return to standby mode
                mainHandler.post {
                    handleSessionStopped()
                }
            }
        )
        
        webSocketManager?.connect(sessionId)
        isConnected = true
        updateNotification("Connected to backend")
    }

    /**
     * Handle session stopped notification from backend.
     * This is called when the RC window is closed by the user.
     */
    private fun handleSessionStopped() {
        Log.i(TAG, "Session stopped - stopping screen capture and returning to standby")
        
        // Stop screen capture (this also invalidates MediaProjection permission and clears sessionId)
        stopScreenCapture()
        
        // Clear pending session state
        pendingSessionId = null
        pendingSessionToken = null
        pendingDeviceId = null
        
        // Update notification
        updateNotification("Standby - waiting for RC session")
    }

    /**
     * Handle start_session event from backend
     * This requests MediaProjection permission and starts screen capture
     */
    private fun handleStartSessionRequest(startSessionData: StartSessionData) {
        Log.i(TAG, "Received start_session request for session: ${startSessionData.sessionId}")
        
        // Check if we're already capturing for this same session
        val currentSession = sessionId ?: pendingSessionId
        if ((isCapturing || pendingSessionId != null) && currentSession == startSessionData.sessionId) {
            Log.i(TAG, "Already capturing for session ${startSessionData.sessionId}")
            
            // Even if we're capturing, ensure the media WebSocket is connected
            // This handles the case where the RC window reconnects after a disconnect
            if (mediaWebSocketManager != null) {
                Log.i(TAG, "Ensuring media WebSocket is connected for existing session")
                mediaWebSocketManager?.connect()
            }
            return
        }
        
        // Stop any existing capture first
        if (isCapturing) {
            Log.i(TAG, "Stopping previous capture before starting new session")
            stopScreenCapture()
        }
        
        // Store the session data for use when MediaProjection is ready
        pendingSessionId = startSessionData.sessionId
        pendingSessionToken = startSessionData.sessionToken
        pendingDeviceId = startSessionData.deviceId
        
        // Check if we already have MediaProjection permission
        if (hasMediaProjectionPermission && mediaProjectionData != null) {
            Log.i(TAG, "MediaProjection permission already granted, starting media capture")
            startMediaCapture(mediaProjectionResultCode, mediaProjectionData!!, startSessionData.sessionId)
        } else {
            // Permission not available - launch MainActivity to request it
            Log.w(TAG, "MediaProjection permission not available (hasPermission=$hasMediaProjectionPermission, data=${mediaProjectionData != null}). Launching MainActivity to request permission.")
            updateNotification("Tap to grant screen capture permission")
            
            // Launch MainActivity to request MediaProjection permission
            // The MainActivity will handle the system permission dialog and send
            // the result back to the service via ACTION_UPDATE_MEDIA_PROJECTION
            try {
                val intent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra("request_media_projection", true)
                }
                startActivity(intent)
                Log.i(TAG, "Launched MainActivity to request MediaProjection permission")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch MainActivity", e)
                updateNotification("Error: Cannot request permission")
            }
        }
    }

    /**
     * Start media capture and connect to media WebSocket
     * Called after MediaProjection permission is granted
     */
    private fun startMediaCapture(resultCode: Int, data: Intent, sessionId: String) {
        try {
            val backendUrl = getString(R.string.backend_url)
            
            // Use session token from start_session event (preferred) or fall back to stored device token
            val authToken = pendingSessionToken ?: getStoredDeviceToken()
            
            if (authToken == null) {
                Log.e(TAG, "No auth token available for media WebSocket (sessionToken=${pendingSessionToken != null}, deviceToken=${getStoredDeviceToken() != null})")
                updateNotification("Error: Missing authentication token")
                return
            }
            
            // Use device ID from start_session event (preferred) or fall back to local device ID
            val devId = pendingDeviceId ?: deviceId
            if (devId == null) {
                Log.e(TAG, "No device ID available for media WebSocket")
                updateNotification("Error: Missing device ID")
                return
            }
            
            Log.i(TAG, "Starting media capture with deviceId=$devId, sessionId=$sessionId, usingSessionToken=${pendingSessionToken != null}")
            
            // Initialize media WebSocket first
            mediaWebSocketManager = MediaWebSocketManager(
                baseUrl = backendUrl,
                deviceId = devId,
                deviceToken = authToken,
                sessionId = sessionId,
                coroutineScope = lifecycleScope,
                diagnosticsManager = diagnosticsManager,
                certificatePins = null
            )
            
            // Connect to media channel
            mediaWebSocketManager?.connect()
            
            // Initialize screen capture manager
            screenCaptureManager = ScreenCaptureManager(
                context = this,
                resultCode = resultCode,
                data = data,
                onFrameEncoded = { buffer, isKeyFrame, codecType ->
                    // Send encoded frame via media WebSocket
                    mediaWebSocketManager?.sendVideoFrame(buffer, isKeyFrame, codecType)
                },
                onError = { exception ->
                    Log.e(TAG, "Screen capture error", exception)
                    updateNotification("Capture error: ${exception.message}")
                },
                diagnosticsManager = diagnosticsManager
            )
            
            val started = screenCaptureManager?.start() ?: false
            if (started) {
                isCapturing = true
                val encoderType = screenCaptureManager?.getEncoderType() ?: "Unknown"
                updateNotification("Streaming with $encoderType")
                Log.i(TAG, "Media capture started with $encoderType")
                
                // Send media metadata with normalized codec name
                val encoderInfo = screenCaptureManager?.getEncoderInfo() ?: emptyMap()
                val width = (encoderInfo["width"] as? Int) ?: 1280
                val height = (encoderInfo["height"] as? Int) ?: 720
                val fps = (encoderInfo["fps"] as? Int) ?: 15
                
                // Initialize the GestureMapper with video dimensions for accurate coordinate mapping
                RemoteAccessibilityService.getInstance()?.initializeGestureMapper(width, height)
                Log.i(TAG, "GestureMapper initialized with video dimensions: ${width}x${height}")
                
                // Normalize codec name to backend-expected format
                val codec = when (encoderType.uppercase()) {
                    "H264", "H.264", "AVC" -> "h264"
                    "MJPEG", "JPEG" -> "mjpeg"
                    else -> {
                        Log.w(TAG, "Unknown encoder type: $encoderType, using lowercase")
                        encoderType.lowercase()
                    }
                }
                
                mediaWebSocketManager?.sendMediaMetadata(width, height, fps, codec)
            } else {
                Log.e(TAG, "Failed to start screen capture")
                updateNotification("Failed to start capture")
                screenCaptureManager = null
                mediaWebSocketManager?.disconnect()
                mediaWebSocketManager = null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting media capture", e)
            updateNotification("Error: ${e.message}")
        }
    }

    /**
     * Stop any ongoing screen capture and media WebSocket.
     * Note: This pauses capture but keeps MediaProjection alive for reuse.
     * The MediaProjection permission is retained so subsequent sessions
     * don't require re-granting permission.
     */
    private fun stopScreenCapture() {
        Log.i(TAG, "Stopping screen capture (keeping MediaProjection for reuse)")
        
        try {
            // Pause capture but keep MediaProjection alive
            screenCaptureManager?.pauseCapture()
        } catch (e: Exception) {
            Log.e(TAG, "Error pausing screen capture", e)
        }
        // Don't null out screenCaptureManager - we'll create new one for next session
        // but the MediaProjection permission data is retained
        screenCaptureManager = null
        
        try {
            mediaWebSocketManager?.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting media WebSocket", e)
        }
        mediaWebSocketManager = null
        
        isCapturing = false
        sessionId = null
        
        // NOTE: Do NOT invalidate MediaProjection permission here
        // Keep hasMediaProjectionPermission = true so we can reuse it
        Log.i(TAG, "Screen capture stopped, MediaProjection permission retained for reuse")
    }

    /**
     * Start screen capture with MediaProjection
     * This is called when MediaProjection permission is provided via intent
     */
    private fun startScreenCapture(resultCode: Int, data: Intent) {
        val sid = pendingSessionId ?: sessionId
        if (sid == null) {
            Log.e(TAG, "Cannot start screen capture: no session ID available")
            updateNotification("Error: No session ID")
            return
        }
        
        Log.i(TAG, "Starting screen capture for session: $sid")
        startMediaCapture(resultCode, data, sid)
    }

    /**
     * Update the foreground notification
     */
    private fun updateNotification(statusText: String) {
        val notification = createNotification(statusText)
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * Create notification channel for Android O+
     * 
     * Creates a notification channel that meets Google Play Store requirements for
     * foreground services. The channel uses IMPORTANCE_LOW to minimize user disruption
     * while maintaining the required persistent notification.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notification_channel_description)
                // Disable sound and vibration for less intrusive notifications
                setSound(null, null)
                enableVibration(false)
                enableLights(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            
            Log.d(TAG, "Notification channel created: $CHANNEL_ID")
        }
    }

    /**
     * Create foreground service notification
     */
    private fun createNotification(contentText: String): Notification {
        // Create intent to open MainActivity when notification is tapped
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Castmill Remote Control")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    /**
     * Store device token in SharedPreferences
     */
    private fun storeDeviceToken(token: String) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putString(PREF_DEVICE_TOKEN, token).apply()
    }

    /**
     * Get stored device token from SharedPreferences
     */
    private fun getStoredDeviceToken(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        return prefs.getString(PREF_DEVICE_TOKEN, null)
    }
}
