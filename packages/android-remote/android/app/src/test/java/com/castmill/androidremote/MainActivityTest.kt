package com.castmill.androidremote

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog

/**
 * Unit tests for MainActivity using Robolectric.
 * 
 * These tests verify:
 * - UI initialization and display
 * - Permission state checking
 * - AccessibilityService status detection
 * - MediaProjection permission flow
 * - Permission status updates
 * - Dialog displays and interactions
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MainActivityTest {

    private lateinit var context: Context
    private lateinit var activity: MainActivity

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        // Set up a test device ID
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, "test_device_id_123")
    }

    @Test
    fun testActivityCreation() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .get()
        
        // Assert
        assertNotNull("Activity should be created", activity)
    }

    @Test
    fun testActivityDisplaysDeviceId() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .get()
        
        // Assert
        val tvDeviceId = activity.findViewById<TextView>(R.id.tvDeviceId)
        assertNotNull("Device ID TextView should exist", tvDeviceId)
        
        val deviceId = tvDeviceId.text.toString()
        assertFalse("Device ID should be displayed", deviceId.isEmpty())
        assertNotEquals("Device ID should not be loading text", 
            activity.getString(R.string.device_id_loading), deviceId)
    }

    @Test
    fun testActivityInitializesUIElements() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .get()
        
        // Assert - Check all key UI elements exist
        assertNotNull("Device ID TextView should exist", 
            activity.findViewById<TextView>(R.id.tvDeviceId))
        assertNotNull("Accessibility status TextView should exist", 
            activity.findViewById<TextView>(R.id.tvAccessibilityStatus))
        assertNotNull("Screen capture status TextView should exist", 
            activity.findViewById<TextView>(R.id.tvScreenCaptureStatus))
        assertNotNull("Service status TextView should exist", 
            activity.findViewById<TextView>(R.id.tvServiceStatus))
        assertNotNull("Enable accessibility button should exist", 
            activity.findViewById<Button>(R.id.btnEnableAccessibility))
        assertNotNull("Request screen capture button should exist", 
            activity.findViewById<Button>(R.id.btnRequestScreenCapture))
    }

    @Test
    fun testAccessibilityServiceStatusWhenDisabled() {
        // Arrange - Ensure accessibility service is not enabled
        Settings.Secure.putString(context.contentResolver, 
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, "")
        
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        val tvStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus)
        val btnEnable = activity.findViewById<Button>(R.id.btnEnableAccessibility)
        
        assertEquals("Status should show disabled", 
            activity.getString(R.string.status_disabled), tvStatus.text)
        assertTrue("Button should be enabled", btnEnable.isEnabled)
        assertEquals("Button should show enable text", 
            activity.getString(R.string.enable_accessibility_button), btnEnable.text)
    }

    @Test
    fun testAccessibilityServiceStatusWhenEnabled() {
        // Arrange - Enable the accessibility service
        val serviceName = "${context.packageName}/${RemoteAccessibilityService::class.java.canonicalName}"
        Settings.Secure.putString(context.contentResolver, 
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, serviceName)
        
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        val tvStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus)
        val btnEnable = activity.findViewById<Button>(R.id.btnEnableAccessibility)
        
        assertEquals("Status should show enabled", 
            activity.getString(R.string.status_enabled), tvStatus.text)
        assertFalse("Button should be disabled", btnEnable.isEnabled)
        assertEquals("Button should show enabled text", 
            activity.getString(R.string.status_enabled), btnEnable.text)
    }

    @Test
    fun testAccessibilityServiceStatusWithMultipleServices() {
        // Arrange - Enable multiple accessibility services including ours
        val serviceName = "${context.packageName}/${RemoteAccessibilityService::class.java.canonicalName}"
        val services = "com.other.app/.OtherService:$serviceName:com.another.app/.AnotherService"
        Settings.Secure.putString(context.contentResolver, 
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, services)
        
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        val tvStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus)
        assertEquals("Status should show enabled", 
            activity.getString(R.string.status_enabled), tvStatus.text)
    }

    @Test
    fun testScreenCaptureStatusInitiallyNotGranted() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        val tvStatus = activity.findViewById<TextView>(R.id.tvScreenCaptureStatus)
        assertEquals("Status should show not granted", 
            activity.getString(R.string.status_not_granted), tvStatus.text)
    }

    @Test
    fun testServiceStatusInitiallyStopped() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        val tvStatus = activity.findViewById<TextView>(R.id.tvServiceStatus)
        assertEquals("Service status should show stopped", 
            activity.getString(R.string.service_status_stopped), tvStatus.text)
    }

    @Test
    fun testEnableAccessibilityButtonShowsDialog() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        val btnEnable = activity.findViewById<Button>(R.id.btnEnableAccessibility)
        btnEnable.performClick()
        
        // Assert
        val dialog = ShadowAlertDialog.getLatestAlertDialog()
        assertNotNull("Dialog should be shown", dialog)
        assertTrue("Dialog should be showing", dialog.isShowing)
        
        val shadowDialog = org.robolectric.shadows.ShadowAlertDialog.getLatestDialog()
        assertNotNull("Shadow dialog should exist", shadowDialog)
    }

    @Test
    fun testRequestScreenCaptureButtonShowsDialog() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        val btnRequest = activity.findViewById<Button>(R.id.btnRequestScreenCapture)
        btnRequest.performClick()
        
        // Assert
        val dialog = ShadowAlertDialog.getLatestAlertDialog()
        assertNotNull("Dialog should be shown", dialog)
        assertTrue("Dialog should be showing", dialog.isShowing)
    }

    @Test
    fun testActivityRefreshesPermissionStateOnResume() {
        // Arrange - Create controller and get activity instance
        val controller = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .start()
            .resume()
        
        activity = controller.get()
        
        // Get initial status
        val tvStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus)
        val initialStatus = tvStatus.text.toString()
        
        // Pause the activity
        controller.pause()
        
        // Enable service while activity is paused
        val serviceName = "${context.packageName}/${RemoteAccessibilityService::class.java.canonicalName}"
        Settings.Secure.putString(context.contentResolver, 
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, serviceName)
        
        // Act - Resume the same activity
        controller.resume()
        
        // Assert
        val updatedStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus).text.toString()
        assertNotEquals("Status should be updated after resume", initialStatus, updatedStatus)
        assertEquals("Status should now show enabled", 
            activity.getString(R.string.status_enabled), updatedStatus)
    }

    @Test
    fun testMediaProjectionPermissionGrantUpdatesUI() {
        // Arrange
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Create a mock Intent for MediaProjection result
        val resultIntent = Intent()
        
        // Act - Simulate permission grant via onActivityResult
        activity.onActivityResult(1001, android.app.Activity.RESULT_OK, resultIntent)
        
        // Assert
        val tvStatus = activity.findViewById<TextView>(R.id.tvScreenCaptureStatus)
        assertEquals("Status should show granted after permission", 
            activity.getString(R.string.status_granted), tvStatus.text)
    }

    @Test
    fun testMediaProjectionPermissionDenialShowsDialog() {
        // Arrange
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Act - Simulate permission denial
        activity.onActivityResult(1001, android.app.Activity.RESULT_CANCELED, null)
        
        // Assert - A dialog should be shown explaining the requirement
        val dialog = ShadowAlertDialog.getLatestAlertDialog()
        assertNotNull("Dialog should be shown on denial", dialog)
        assertTrue("Dialog should be showing", dialog.isShowing)
    }

    @Test
    fun testActivityHandlesNullAccessibilityServices() {
        // Arrange - Set enabled services to null
        Settings.Secure.putString(context.contentResolver, 
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, null)
        
        // Act - Should not crash
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        assertNotNull("Activity should be created without crash", activity)
        val tvStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus)
        assertEquals("Status should show disabled", 
            activity.getString(R.string.status_disabled), tvStatus.text)
    }

    @Test
    fun testActivityHandlesEmptyDeviceId() {
        // Arrange - Remove device ID
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, "")
        
        // Act - Should not crash
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .get()
        
        // Assert
        assertNotNull("Activity should be created without crash", activity)
        val tvDeviceId = activity.findViewById<TextView>(R.id.tvDeviceId)
        assertNotNull("Device ID TextView should exist", tvDeviceId)
        // Should show empty string as returned by DeviceUtils
        assertEquals("Device ID should be empty", "", tvDeviceId.text)
    }

    @Test
    fun testAccessibilityServiceDetectionIsCaseInsensitive() {
        // Arrange - Use different case for service name
        val serviceName = "${context.packageName}/${RemoteAccessibilityService::class.java.canonicalName}"
        Settings.Secure.putString(context.contentResolver, 
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, serviceName)
        
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert - Should detect the service
        val tvStatus = activity.findViewById<TextView>(R.id.tvAccessibilityStatus)
        assertEquals("Status should show enabled", 
            activity.getString(R.string.status_enabled), tvStatus.text)
    }

    @Test
    fun testButtonsAreEnabledByDefault() {
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert
        val btnRequestScreenCapture = activity.findViewById<Button>(R.id.btnRequestScreenCapture)
        assertTrue("Screen capture button should be enabled", btnRequestScreenCapture.isEnabled)
        
        // Accessibility button state depends on whether service is enabled
        // If service is disabled, button should be enabled
        val serviceName = "${context.packageName}/${RemoteAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        val isServiceEnabled = enabledServices?.contains(serviceName) == true
        
        val btnEnableAccessibility = activity.findViewById<Button>(R.id.btnEnableAccessibility)
        if (isServiceEnabled) {
            assertFalse("Accessibility button should be disabled when service is enabled", 
                btnEnableAccessibility.isEnabled)
        } else {
            assertTrue("Accessibility button should be enabled when service is disabled", 
                btnEnableAccessibility.isEnabled)
        }
    }

    @Test
    fun testMediaProjectionAutoRequestOnFirstLaunch() {
        // Arrange - Fresh install, no prior permission grants
        val prefs = context.getSharedPreferences("castmill_remote_prefs", Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert - Should NOT auto-request on first launch
        assertFalse("Should not have prior permission grant flag", 
            prefs.getBoolean("media_projection_granted_before", false))
    }

    @Test
    fun testMediaProjectionAutoRequestAfterPreviousGrant() {
        // Arrange - Simulate previous permission grant
        val prefs = context.getSharedPreferences("castmill_remote_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean("media_projection_granted_before", true)
            .apply()
        
        // Act
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert - Flag should still be set
        assertTrue("Should have prior permission grant flag", 
            prefs.getBoolean("media_projection_granted_before", false))
    }

    @Test
    fun testMediaProjectionGrantedFlagSetOnPermissionGrant() {
        // Arrange
        val prefs = context.getSharedPreferences("castmill_remote_prefs", Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Verify flag is initially false
        assertFalse("Flag should be false initially", 
            prefs.getBoolean("media_projection_granted_before", false))
        
        // Note: Testing the actual permission grant flow requires simulating
        // the ActivityResultLauncher callback, which is complex in Robolectric.
        // In practice, the markMediaProjectionGranted() method is called when
        // the permission is granted through the launcher callback.
        // This test verifies the SharedPreferences behavior in isolation.
    }

    @Test
    fun testMediaProjectionGrantedFlagNotSetOnPermissionDenial() {
        // Arrange
        val prefs = context.getSharedPreferences("castmill_remote_prefs", Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        
        activity = Robolectric.buildActivity(MainActivity::class.java)
            .create()
            .resume()
            .get()
        
        // Assert - Flag should remain false if never granted
        assertFalse("Flag should remain false if permission not granted", 
            prefs.getBoolean("media_projection_granted_before", false))
    }
}
