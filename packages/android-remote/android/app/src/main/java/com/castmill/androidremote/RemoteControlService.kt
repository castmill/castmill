package com.castmill.androidremote

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.projection.MediaProjection
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
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
        
        // Intent extras
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_DEVICE_TOKEN = "device_token"
        
        // SharedPreferences
        private const val PREFS_NAME = "castmill_remote_prefs"
        private const val PREF_DEVICE_TOKEN = "device_token"
    }

    private var mediaProjection: MediaProjection? = null
    private var webSocketManager: WebSocketManager? = null
    private var deviceId: String? = null
    private var isConnected = false

    override fun onCreate() {
        super.onCreate()
        
        // Compute device ID
        deviceId = DeviceUtils.getDeviceId(this)
        
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification("Initializing..."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        
        // Get session ID and device token from intent
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID)
        val deviceToken = intent?.getStringExtra(EXTRA_DEVICE_TOKEN)
            ?: getStoredDeviceToken()
        
        if (sessionId != null && deviceToken != null && deviceId != null) {
            // Store device token for future use
            if (intent?.hasExtra(EXTRA_DEVICE_TOKEN) == true) {
                storeDeviceToken(deviceToken)
            }
            
            // Initialize and connect WebSocket
            lifecycleScope.launch {
                connectWebSocket(sessionId, deviceToken)
            }
        } else {
            android.util.Log.e(TAG, "Missing required parameters: sessionId=$sessionId, token=${deviceToken != null}, deviceId=$deviceId")
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
        
        // Clean up resources
        webSocketManager?.disconnect()
        webSocketManager = null
        
        mediaProjection?.stop()
        mediaProjection = null
    }

    /**
     * Connect to the backend WebSocket
     */
    private fun connectWebSocket(sessionId: String, deviceToken: String) {
        val backendUrl = getString(R.string.backend_url)
        
        webSocketManager = WebSocketManager(
            baseUrl = backendUrl,
            deviceId = deviceId!!,
            deviceToken = deviceToken,
            coroutineScope = lifecycleScope
        )
        
        webSocketManager?.connect(sessionId)
        isConnected = true
        updateNotification("Connected to backend")
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
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Remote control service notification"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
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
