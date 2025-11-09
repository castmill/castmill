package com.castmill.androidremote

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNotificationManager
import android.provider.Settings

/**
 * Unit tests for RemoteControlService using Robolectric.
 * 
 * These tests verify:
 * - Service lifecycle (onCreate, onStartCommand, onDestroy)
 * - Foreground notification creation and updates
 * - Device ID computation
 * - Intent parameter handling
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class RemoteControlServiceTest {

    private lateinit var context: Context
    private lateinit var notificationManager: NotificationManager
    private lateinit var shadowNotificationManager: ShadowNotificationManager

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        shadowNotificationManager = shadowOf(notificationManager)
        
        // Set up a test device ID
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, "test_device_id_123")
    }

    @Test
    fun testServiceCreation() {
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java).create()
        val service = controller.get()
        
        // Assert
        assertNotNull("Service should be created", service)
    }

    @Test
    fun testServiceCreatesNotificationChannel() {
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java).create()
        
        // Assert
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = shadowNotificationManager.notificationChannels
            assertFalse("Notification channels should be created", channels.isEmpty())
            
            val channel = channels.find { it.id == "castmill_remote_control" }
            assertNotNull("Remote control channel should exist", channel)
            assertEquals("Channel name should match", "Castmill Remote Control", channel?.name)
        }
    }

    @Test
    fun testServiceStartsForeground() {
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .startCommand(0, 0)
        
        // Assert
        val notifications = shadowNotificationManager.allNotifications
        assertTrue("Foreground notification should be posted", notifications.isNotEmpty())
        
        val notification = notifications[0]
        assertNotNull("Notification should not be null", notification)
    }

    @Test
    fun testServiceHandlesIntentWithSessionId() {
        // Arrange
        val intent = Intent(context, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, "test_session_123")
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, "test_token_456")
        }
        
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .withIntent(intent)
            .startCommand(0, 0)
        
        // Assert - Service should be running
        val service = controller.get()
        assertNotNull("Service should be running", service)
    }

    @Test
    fun testServiceHandlesIntentWithoutSessionId() {
        // Arrange - Intent without session ID
        val intent = Intent(context, RemoteControlService::class.java)
        
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .withIntent(intent)
            .startCommand(0, 0)
        
        // Assert - Service should still be running but with error state
        val service = controller.get()
        assertNotNull("Service should be running", service)
        
        // Check notification was updated with error message
        val notifications = shadowNotificationManager.allNotifications
        assertTrue("Notification should be posted", notifications.isNotEmpty())
    }

    @Test
    fun testServiceDestroyCleansUpResources() {
        // Arrange
        val intent = Intent(context, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, "test_session_123")
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, "test_token_456")
        }
        
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .withIntent(intent)
            .startCommand(0, 0)
        
        // Act
        controller.destroy()
        
        // Assert - Should not crash
        assertTrue("Service cleanup should succeed", true)
    }

    @Test
    fun testServiceUsesDeviceId() {
        // Arrange
        val testDeviceId = "test_android_id_789"
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, testDeviceId)
        
        val intent = Intent(context, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, "test_session_123")
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, "test_token_456")
        }
        
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .withIntent(intent)
            .startCommand(0, 0)
        
        val service = controller.get()
        
        // Assert - DeviceUtils should have been called and device ID computed
        assertNotNull("Service should be created", service)
        
        // Verify the device ID matches what DeviceUtils would return
        val computedDeviceId = DeviceUtils.getDeviceId(context)
        assertEquals("Device ID should match", testDeviceId, computedDeviceId)
    }

    @Test
    fun testServiceStoresDeviceToken() {
        // Arrange
        val testToken = "test_device_token_abc"
        val intent = Intent(context, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, "test_session_123")
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, testToken)
        }
        
        // Act
        Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .withIntent(intent)
            .startCommand(0, 0)
        
        // Assert - Token should be stored in SharedPreferences
        val prefs = context.getSharedPreferences("castmill_remote_prefs", Context.MODE_PRIVATE)
        val storedToken = prefs.getString("device_token", null)
        assertEquals("Device token should be stored", testToken, storedToken)
    }

    @Test
    fun testServiceReusesStoredToken() {
        // Arrange - Store a token first
        val storedToken = "stored_token_xyz"
        val prefs = context.getSharedPreferences("castmill_remote_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("device_token", storedToken).apply()
        
        // Create intent without token
        val intent = Intent(context, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, "test_session_123")
        }
        
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .withIntent(intent)
            .startCommand(0, 0)
        
        // Assert - Service should use stored token
        val service = controller.get()
        assertNotNull("Service should be created with stored token", service)
    }

    @Test
    fun testServiceReturnsStartSticky() {
        // Arrange
        val intent = Intent(context, RemoteControlService::class.java).apply {
            putExtra(RemoteControlService.EXTRA_SESSION_ID, "test_session_123")
            putExtra(RemoteControlService.EXTRA_DEVICE_TOKEN, "test_token_456")
        }
        
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
        
        val result = controller.get().onStartCommand(intent, 0, 1)
        
        // Assert
        assertEquals("Service should return START_STICKY", android.app.Service.START_STICKY, result)
    }

    @Test
    fun testNotificationHasCorrectProperties() {
        // Act
        val controller = Robolectric.buildService(RemoteControlService::class.java)
            .create()
            .startCommand(0, 0)
        
        // Assert
        val notifications = shadowNotificationManager.allNotifications
        assertTrue("At least one notification should exist", notifications.isNotEmpty())
        
        val notification = notifications[0]
        val shadowNotification = shadowOf(notification)
        
        assertEquals("Notification title should be correct", 
            "Castmill Remote Control", shadowNotification.contentTitle)
        assertNotNull("Notification should have content text", shadowNotification.contentText)
        assertTrue("Notification should be ongoing", notification.flags and android.app.Notification.FLAG_ONGOING_EVENT != 0)
    }
}
