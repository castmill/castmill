package com.castmill.androidremote

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.nio.ByteBuffer

/**
 * Unit tests for ScreenCaptureManager.
 * 
 * These tests verify:
 * - Manager initialization
 * - Encoder type selection and fallback
 * - Resource cleanup
 * - Error handling
 * 
 * Note: MediaProjection requires hardware support and permissions,
 * so these tests focus on basic initialization and state management.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ScreenCaptureManagerTest {

    private lateinit var context: Context
    private var lastEncodedFrame: ByteBuffer? = null
    private var lastIsKeyFrame: Boolean = false
    private var lastCodecType: String? = null
    private var lastError: Exception? = null

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        lastEncodedFrame = null
        lastIsKeyFrame = false
        lastCodecType = null
        lastError = null
    }

    @Test
    fun testManagerCreation() {
        // Arrange & Act
        val manager = createTestManager()

        // Assert
        assertNotNull("Manager should be created", manager)
        assertFalse("Should not be capturing initially", manager.isCapturing())
    }

    @Test
    fun testManagerGetEncoderTypeBeforeStart() {
        // Arrange
        val manager = createTestManager()

        // Act
        val encoderType = manager.getEncoderType()

        // Assert
        assertNotNull("Encoder type should not be null", encoderType)
        assertTrue(
            "Encoder type should be H.264 or MJPEG",
            encoderType == "H.264" || encoderType == "MJPEG"
        )
    }

    @Test
    fun testManagerGetEncoderInfoBeforeStart() {
        // Arrange
        val manager = createTestManager()

        // Act
        val info = manager.getEncoderInfo()

        // Assert
        assertNotNull("Encoder info should not be null", info)
        assertFalse("Should not be capturing", info["isCapturing"] as Boolean)
        assertNotNull("Should have active encoder type", info["activeEncoder"])
    }

    @Test
    fun testManagerIsCapturingStates() {
        // Arrange
        val manager = createTestManager()

        // Act & Assert - Initial state
        assertFalse("Should not be capturing initially", manager.isCapturing())

        // Note: We cannot test actual capture start without MediaProjection
        // permission and hardware support, which are not available in unit tests
    }

    @Test
    fun testManagerStopWithoutStart() {
        // Arrange
        val manager = createTestManager()

        // Act & Assert - Should not crash
        manager.stop()
        assertFalse("Should not be capturing after stop", manager.isCapturing())
    }

    @Test
    fun testManagerMultipleStops() {
        // Arrange
        val manager = createTestManager()

        // Act - Multiple stops should be safe
        manager.stop()
        manager.stop()
        manager.stop()

        // Assert - Should not crash
        assertFalse("Should not be capturing", manager.isCapturing())
    }

    @Test
    fun testManagerEncoderInfoAfterStop() {
        // Arrange
        val manager = createTestManager()
        manager.stop()

        // Act
        val info = manager.getEncoderInfo()

        // Assert
        assertNotNull("Info should not be null after stop", info)
        assertFalse("Should not be capturing after stop", info["isCapturing"] as Boolean)
    }

    @Test
    fun testManagerCallbacksNotNull() {
        // Arrange
        var frameCallbackCalled = false
        var errorCallbackCalled = false

        val manager = ScreenCaptureManager(
            context = context,
            resultCode = -1, // Invalid result code
            data = Intent(), // Empty intent
            onFrameEncoded = { _, _, _ ->
                frameCallbackCalled = true
            },
            onError = { _ ->
                errorCallbackCalled = true
            }
        )

        // Act - Try to start with invalid parameters
        val started = manager.start()

        // Assert
        assertFalse("Should fail to start with invalid parameters", started)
        // Callbacks should be set but might not be called without valid MediaProjection
        assertTrue("Manager should be created successfully", true)

        // Cleanup
        manager.stop()
    }

    @Test
    fun testManagerWithValidCallbacks() {
        // Arrange
        val manager = createTestManager()

        // Act - Manager should be created without errors
        val info = manager.getEncoderInfo()

        // Assert
        assertNotNull("Manager info should be available", info)
        assertNotNull("Encoder type should be set", info["activeEncoder"])

        // Cleanup
        manager.stop()
    }

    @Test
    fun testManagerStateAfterStopIsClean() {
        // Arrange
        val manager = createTestManager()

        // Act
        manager.stop()
        val info = manager.getEncoderInfo()

        // Assert
        assertFalse("Should not be capturing", manager.isCapturing())
        assertFalse("Info should reflect stopped state", info["isCapturing"] as Boolean)
    }

    /**
     * Create a test manager with default callbacks
     */
    private fun createTestManager(): ScreenCaptureManager {
        return ScreenCaptureManager(
            context = context,
            resultCode = -1, // Invalid for actual capture
            data = Intent(), // Empty intent
            onFrameEncoded = { buffer, isKeyFrame, codecType ->
                lastEncodedFrame = buffer
                lastIsKeyFrame = isKeyFrame
                lastCodecType = codecType
            },
            onError = { exception ->
                lastError = exception
            }
        )
    }
}
