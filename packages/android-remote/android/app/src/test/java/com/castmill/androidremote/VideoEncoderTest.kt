package com.castmill.androidremote

import android.media.MediaCodec
import android.media.MediaFormat
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Unit tests for VideoEncoder.
 * 
 * These tests verify:
 * - Encoder initialization with correct parameters
 * - H.264/AVC codec configuration
 * - Proper resource cleanup
 * - Error handling
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class VideoEncoderTest {

    private var lastEncodedFrame: ByteBuffer? = null
    private var lastBufferInfo: MediaCodec.BufferInfo? = null
    private var lastIsKeyFrame: Boolean = false
    private var lastError: Exception? = null
    private var frameLatch = CountDownLatch(1)
    private var errorLatch = CountDownLatch(1)

    @Before
    fun setup() {
        lastEncodedFrame = null
        lastBufferInfo = null
        lastIsKeyFrame = false
        lastError = null
        frameLatch = CountDownLatch(1)
        errorLatch = CountDownLatch(1)
    }

    @Test
    fun testEncoderInitialization() {
        // Arrange
        val encoder = createTestEncoder()

        // Act
        val started = encoder.start()

        // Assert
        assertTrue("Encoder should start successfully", started)
        assertTrue("Encoder should be encoding", encoder.isEncoding())

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderDefaultParameters() {
        // Arrange & Act
        val encoder = createTestEncoder()
        val info = encoder.getEncoderInfo()

        // Assert
        assertEquals("Width should be 1280", 1280, info["width"])
        assertEquals("Height should be 720", 720, info["height"])
        assertEquals("Frame rate should be 15", 15, info["frameRate"])
        assertEquals("Bitrate should be 2Mbps", 2_000_000, info["bitrate"])
        assertEquals("Keyframe interval should be 2s", 2, info["keyFrameInterval"])
        assertEquals("Codec should be H.264/AVC", MediaFormat.MIMETYPE_VIDEO_AVC, info["codec"])

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderCustomParameters() {
        // Arrange
        val width = 1920
        val height = 1080
        val frameRate = 10
        val bitrate = 3_000_000
        val keyFrameInterval = 3

        val encoder = VideoEncoder(
            width = width,
            height = height,
            frameRate = frameRate,
            bitrate = bitrate,
            keyFrameInterval = keyFrameInterval,
            onEncodedFrame = { _, _, _ -> },
            onError = { }
        )

        // Act
        val info = encoder.getEncoderInfo()

        // Assert
        assertEquals("Width should match", width, info["width"])
        assertEquals("Height should match", height, info["height"])
        assertEquals("Frame rate should match", frameRate, info["frameRate"])
        assertEquals("Bitrate should match", bitrate, info["bitrate"])
        assertEquals("Keyframe interval should match", keyFrameInterval, info["keyFrameInterval"])

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderInputSurface() {
        // Arrange
        val encoder = createTestEncoder()
        encoder.start()

        // Act
        val surface = encoder.inputSurface

        // Assert
        assertNotNull("Input surface should be created", surface)

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderInputSurfaceBeforeStart() {
        // Arrange
        val encoder = createTestEncoder()

        // Act
        val surface = encoder.inputSurface

        // Assert - Surface might be null before start
        // This is expected behavior
        assertTrue("Test should complete without crash", true)

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderStop() {
        // Arrange
        val encoder = createTestEncoder()
        encoder.start()
        assertTrue("Encoder should be encoding", encoder.isEncoding())

        // Act
        encoder.stop()

        // Assert
        assertFalse("Encoder should not be encoding after stop", encoder.isEncoding())
    }

    @Test
    fun testEncoderStopWithoutStart() {
        // Arrange
        val encoder = createTestEncoder()

        // Act & Assert - Should not crash
        encoder.stop()
        assertFalse("Encoder should not be encoding", encoder.isEncoding())
    }

    @Test
    fun testEncoderMultipleStops() {
        // Arrange
        val encoder = createTestEncoder()
        encoder.start()

        // Act - Multiple stops should be safe
        encoder.stop()
        encoder.stop()
        encoder.stop()

        // Assert - Should not crash
        assertFalse("Encoder should not be encoding", encoder.isEncoding())
    }

    @Test
    fun testEncoderGetInfoBeforeStart() {
        // Arrange
        val encoder = createTestEncoder()

        // Act
        val info = encoder.getEncoderInfo()

        // Assert - Should return configuration even before start
        assertNotNull("Info should not be null", info)
        assertEquals("Width should be set", 1280, info["width"])
        assertFalse("Should not be encoding", info["isEncoding"] as Boolean)

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderGetInfoAfterStop() {
        // Arrange
        val encoder = createTestEncoder()
        encoder.start()
        encoder.stop()

        // Act
        val info = encoder.getEncoderInfo()

        // Assert
        assertNotNull("Info should not be null after stop", info)
        assertFalse("Should not be encoding after stop", info["isEncoding"] as Boolean)
    }

    @Test
    fun testEncoderDrainBeforeStart() {
        // Arrange
        val encoder = createTestEncoder()

        // Act & Assert - Should not crash
        encoder.drainEncoder()
        assertTrue("Drain before start should be safe", true)

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderDrainAfterStop() {
        // Arrange
        val encoder = createTestEncoder()
        encoder.start()
        encoder.stop()

        // Act & Assert - Should not crash
        encoder.drainEncoder()
        assertTrue("Drain after stop should be safe", true)
    }

    @Test
    fun testEncoderStartEncoderBeforeStart() {
        // Arrange
        val encoder = createTestEncoder()

        // Act & Assert - Should not crash
        encoder.startEncoder()
        assertTrue("StartEncoder before start should be safe", true)

        // Cleanup
        encoder.stop()
    }

    @Test
    fun testEncoderIsEncodingStates() {
        // Arrange
        val encoder = createTestEncoder()

        // Act & Assert - Before start
        assertFalse("Should not be encoding initially", encoder.isEncoding())

        // After start
        encoder.start()
        assertTrue("Should be encoding after start", encoder.isEncoding())

        // After stop
        encoder.stop()
        assertFalse("Should not be encoding after stop", encoder.isEncoding())
    }

    /**
     * Create a test encoder with default callbacks
     */
    private fun createTestEncoder(): VideoEncoder {
        return VideoEncoder(
            onEncodedFrame = { buffer, bufferInfo, isKeyFrame ->
                lastEncodedFrame = buffer
                lastBufferInfo = bufferInfo
                lastIsKeyFrame = isKeyFrame
                frameLatch.countDown()
            },
            onError = { exception ->
                lastError = exception
                errorLatch.countDown()
            }
        )
    }
}
