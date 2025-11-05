package com.castmill.androidremote

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
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
 * - Screen capture via MediaProjection
 * - Screen encoding via MediaCodec
 * - WebSocket connection for remote control
 * - Communication with RemoteAccessibilityService for input injection
 */
class RemoteControlService : LifecycleService() {

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "castmill_remote_control"
        private const val CHANNEL_NAME = "Castmill Remote Control"
    }

    private var mediaProjection: MediaProjection? = null

    override fun onCreate() {
        super.onCreate()
        
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        
        // TODO: Initialize WebSocket connection
        // TODO: Initialize MediaProjection and MediaCodec
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        
        // TODO: Handle intent extras for MediaProjection result
        
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        
        // Clean up resources
        mediaProjection?.stop()
        mediaProjection = null
        
        // TODO: Close WebSocket connection
        // TODO: Release MediaCodec
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
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Castmill Remote Control")
            .setContentText("Remote control service is active")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
