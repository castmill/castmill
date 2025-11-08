package com.castmill.androidremote

import android.content.Context
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowSettings

/**
 * Unit tests for DeviceUtils using Robolectric.
 * 
 * These tests verify that getDeviceId() returns the same device identifier
 * that Capacitor's Device.getId() would return on Android (Settings.Secure.ANDROID_ID).
 * 
 * Robolectric allows us to test Android framework code without requiring a physical
 * device or emulator, providing a proper Android environment for testing.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28]) // API 28 is well-supported by Robolectric
class DeviceUtilsTest {

    private lateinit var context: Context

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
    }

    @Test
    fun testGetDeviceId_returnsValidId() {
        // Arrange
        val testDeviceId = "1234567890abcdef"
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, testDeviceId)
        
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertNotNull("Device ID should not be null", deviceId)
        assertEquals("Device ID should match the Android ID", testDeviceId, deviceId)
    }

    @Test
    fun testGetDeviceId_returnsString() {
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertTrue("Device ID should be a String", deviceId is String)
    }

    @Test
    fun testGetDeviceId_handlesNullGracefully() {
        // Arrange - Set ANDROID_ID to null
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, null)
        
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertNotNull("Device ID should not be null even if Settings.Secure returns null", deviceId)
        assertEquals("Device ID should be empty string when Settings.Secure returns null", "", deviceId)
    }

    @Test
    fun testGetDeviceId_consistentAcrossMultipleCalls() {
        // Arrange
        val testDeviceId = "abcdef1234567890"
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, testDeviceId)
        
        // Act
        val deviceId1 = DeviceUtils.getDeviceId(context)
        val deviceId2 = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertEquals("Device ID should be consistent across multiple calls", deviceId1, deviceId2)
        assertEquals("Device ID should match the set value", testDeviceId, deviceId1)
    }

    @Test
    fun testGetDeviceId_neverReturnsNull() {
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertNotNull("Device ID should never return null, return empty string instead", deviceId)
    }

    @Test
    fun testGetDeviceId_matchesCapacitorBehavior() {
        // This test verifies that our implementation matches Capacitor's Device.getId()
        // which returns Settings.Secure.ANDROID_ID on Android
        
        // Arrange
        val expectedDeviceId = "fedcba0987654321"
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, expectedDeviceId)
        
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        val directAndroidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        
        // Assert
        assertEquals("Our getDeviceId should return the same value as Settings.Secure.ANDROID_ID",
            directAndroidId, deviceId)
        assertEquals("Device ID should match the expected value", expectedDeviceId, deviceId)
    }

    @Test
    fun testGetDeviceId_withEmptyString() {
        // Arrange
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, "")
        
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertEquals("Device ID should handle empty string", "", deviceId)
    }

    @Test
    fun testGetDeviceId_withTypicalHexString() {
        // Arrange - Typical ANDROID_ID is a 16-character hex string
        val typicalDeviceId = "0123456789abcdef"
        Settings.Secure.putString(context.contentResolver, Settings.Secure.ANDROID_ID, typicalDeviceId)
        
        // Act
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // Assert
        assertEquals("Device ID should match typical hex string format", typicalDeviceId, deviceId)
        assertEquals("Device ID should be 16 characters", 16, deviceId.length)
        assertTrue("Device ID should contain only hex characters", 
            deviceId.matches(Regex("[0-9a-f]+")))
    }
}
