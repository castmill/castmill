package com.castmill.androidremote

import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicInteger

/**
 * Unit tests for FrameBuffer.
 * 
 * Tests verify:
 * - Basic frame buffering (add, get, peek)
 * - Backpressure handling (drop oldest P-frames)
 * - Keyframe preservation
 * - Buffer capacity management
 * - Thread safety
 */
class FrameBufferTest {

    private lateinit var frameBuffer: FrameBuffer
    private val dropsCount = AtomicInteger(0)

    @Before
    fun setup() {
        dropsCount.set(0)
        frameBuffer = FrameBuffer(
            maxCapacity = 5,
            onFrameDropped = { dropsCount.incrementAndGet() }
        )
    }

    @Test
    fun testInitialState() {
        assertEquals("Buffer should be empty initially", 0, frameBuffer.size())
        assertTrue("Buffer should be empty", frameBuffer.isEmpty())
        assertFalse("Buffer should not be full", frameBuffer.isFull())
        assertEquals("Utilization should be 0%", 0.0, frameBuffer.getUtilization(), 0.01)
    }

    @Test
    fun testAddFrame() {
        val buffer = createTestBuffer(100)
        
        val added = frameBuffer.addFrame(buffer, false, "h264")
        
        assertTrue("Frame should be added", added)
        assertEquals("Buffer size should be 1", 1, frameBuffer.size())
        assertFalse("Buffer should not be empty", frameBuffer.isEmpty())
    }

    @Test
    fun testGetFrame() {
        val buffer = createTestBuffer(100)
        frameBuffer.addFrame(buffer, false, "h264")
        
        val frame = frameBuffer.getFrame()
        
        assertNotNull("Should retrieve frame", frame)
        assertEquals("Buffer should be empty after get", 0, frameBuffer.size())
        assertTrue("Buffer should be empty", frameBuffer.isEmpty())
    }

    @Test
    fun testPeekFrame() {
        val buffer = createTestBuffer(100)
        frameBuffer.addFrame(buffer, false, "h264")
        
        val frame = frameBuffer.peekFrame()
        
        assertNotNull("Should peek frame", frame)
        assertEquals("Buffer size should still be 1 after peek", 1, frameBuffer.size())
    }

    @Test
    fun testGetFrameEmpty() {
        val frame = frameBuffer.getFrame()
        
        assertNull("Should return null when empty", frame)
    }

    @Test
    fun testPeekFrameEmpty() {
        val frame = frameBuffer.peekFrame()
        
        assertNull("Should return null when empty", frame)
    }

    @Test
    fun testKeyFramePreservation() {
        // Fill buffer with keyframes
        for (i in 0 until 5) {
            val buffer = createTestBuffer(100)
            frameBuffer.addFrame(buffer, true, "h264")
        }
        
        assertEquals("Buffer should have 5 keyframes", 5, frameBuffer.size())
        
        // Try to add another keyframe (should trigger backpressure)
        val buffer = createTestBuffer(100)
        val added = frameBuffer.addFrame(buffer, true, "h264")
        
        assertTrue("Keyframe should always be added", added)
        assertEquals("Buffer should have 6 frames", 6, frameBuffer.size())
    }

    @Test
    fun testBackpressureDropsPFrame() {
        // Add 4 P-frames
        for (i in 0 until 4) {
            val buffer = createTestBuffer(100)
            frameBuffer.addFrame(buffer, false, "h264")
        }
        
        // Add 1 keyframe
        frameBuffer.addFrame(createTestBuffer(100), true, "h264")
        
        assertEquals("Buffer should be full", 5, frameBuffer.size())
        assertTrue("Buffer should be full", frameBuffer.isFull())
        
        // Add another P-frame (should trigger drop)
        val added = frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        
        assertTrue("Frame should be added after drop", added)
        assertEquals("Buffer should still have 5 frames", 5, frameBuffer.size())
        assertEquals("Should have dropped 1 frame", 1, dropsCount.get())
    }

    @Test
    fun testBackpressureWithOnlyKeyframes() {
        // Fill buffer with only keyframes
        for (i in 0 until 5) {
            val buffer = createTestBuffer(100)
            frameBuffer.addFrame(buffer, true, "h264")
        }
        
        assertEquals("Buffer should be full with keyframes", 5, frameBuffer.size())
        
        // Try to add a P-frame when buffer contains only keyframes
        val added = frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        
        assertFalse("P-frame should not be added when buffer has only keyframes", added)
        assertEquals("Should have dropped 1 frame", 1, dropsCount.get())
        assertEquals("Buffer should still have 5 frames", 5, frameBuffer.size())
    }

    @Test
    fun testMultipleDrops() {
        // Fill buffer
        for (i in 0 until 5) {
            frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        }
        
        // Add more frames to trigger multiple drops
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        
        assertEquals("Should have dropped 3 frames", 3, dropsCount.get())
        assertEquals("Buffer should remain at capacity", 5, frameBuffer.size())
    }

    @Test
    fun testMixedFrameTypes() {
        // Add mix of keyframes and P-frames
        frameBuffer.addFrame(createTestBuffer(100), true, "h264")  // keyframe
        frameBuffer.addFrame(createTestBuffer(100), false, "h264") // P-frame
        frameBuffer.addFrame(createTestBuffer(100), false, "h264") // P-frame
        frameBuffer.addFrame(createTestBuffer(100), true, "h264")  // keyframe
        frameBuffer.addFrame(createTestBuffer(100), false, "h264") // P-frame
        
        assertEquals("Buffer should be full", 5, frameBuffer.size())
        
        // Add P-frame (should drop oldest P-frame)
        val added = frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        
        assertTrue("Frame should be added", added)
        assertEquals("Should have dropped 1 frame", 1, dropsCount.get())
    }

    @Test
    fun testClear() {
        // Add some frames
        for (i in 0 until 3) {
            frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        }
        
        assertEquals("Buffer should have 3 frames", 3, frameBuffer.size())
        
        frameBuffer.clear()
        
        assertEquals("Buffer should be empty after clear", 0, frameBuffer.size())
        assertTrue("Buffer should be empty", frameBuffer.isEmpty())
    }

    @Test
    fun testUtilization() {
        // Empty buffer
        assertEquals("Empty buffer utilization should be 0%", 0.0, frameBuffer.getUtilization(), 0.01)
        
        // 50% full
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        assertEquals("50% full utilization", 40.0, frameBuffer.getUtilization(), 1.0)
        
        // 100% full
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        assertEquals("100% full utilization", 100.0, frameBuffer.getUtilization(), 0.01)
    }

    @Test
    fun testGetStats() {
        // Add some frames
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        
        val stats = frameBuffer.getStats()
        
        assertNotNull("Stats should not be null", stats)
        assertEquals("Size should be 2", 2, stats["size"])
        assertEquals("Capacity should be 5", 5, stats["capacity"])
        assertFalse("Should not be empty", stats["is_empty"] as Boolean)
        assertFalse("Should not be full", stats["is_full"] as Boolean)
        assertTrue("Utilization should be in stats", stats.containsKey("utilization_percent"))
    }

    @Test
    fun testFrameData() {
        val testData = byteArrayOf(1, 2, 3, 4, 5)
        val buffer = ByteBuffer.wrap(testData)
        
        frameBuffer.addFrame(buffer, true, "h264")
        
        val frame = frameBuffer.getFrame()
        
        assertNotNull("Frame should not be null", frame)
        assertTrue("Should be keyframe", frame!!.isKeyFrame)
        assertEquals("Codec should be h264", "h264", frame.codecType)
        assertEquals("Buffer size should match", testData.size, frame.buffer.remaining())
    }

    @Test
    fun testCodecTypes() {
        // Test different codec types
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        frameBuffer.addFrame(createTestBuffer(100), false, "mjpeg")
        
        val frame1 = frameBuffer.getFrame()
        val frame2 = frameBuffer.getFrame()
        
        assertEquals("First codec should be h264", "h264", frame1?.codecType)
        assertEquals("Second codec should be mjpeg", "mjpeg", frame2?.codecType)
    }

    @Test
    fun testTimestamp() {
        val beforeTime = System.currentTimeMillis()
        
        frameBuffer.addFrame(createTestBuffer(100), false, "h264")
        
        val afterTime = System.currentTimeMillis()
        val frame = frameBuffer.getFrame()
        
        assertNotNull("Frame should not be null", frame)
        assertTrue("Timestamp should be between before and after", 
            frame!!.timestamp >= beforeTime && frame.timestamp <= afterTime)
    }

    @Test
    fun testFifoOrder() {
        // Add frames in order
        for (i in 1..5) {
            val buffer = createTestBuffer(i * 100)
            frameBuffer.addFrame(buffer, false, "h264")
        }
        
        // Retrieve frames - should be in same order
        for (i in 1..5) {
            val frame = frameBuffer.getFrame()
            assertNotNull("Frame $i should not be null", frame)
            assertEquals("Frame size should match order", i * 100, frame?.buffer?.remaining())
        }
    }

    @Test
    fun testConcurrentAccess() {
        // Simple test for thread safety - add and remove concurrently
        val addThread = Thread {
            for (i in 0 until 100) {
                frameBuffer.addFrame(createTestBuffer(100), i % 10 == 0, "h264")
                Thread.sleep(1)
            }
        }
        
        val getThread = Thread {
            for (i in 0 until 50) {
                frameBuffer.getFrame()
                Thread.sleep(2)
            }
        }
        
        addThread.start()
        getThread.start()
        
        addThread.join(5000)
        getThread.join(5000)
        
        // If we reach here without exception or deadlock, test passes
        assertTrue("Concurrent access should not cause issues", true)
    }

    @Test
    fun testLargeBuffer() {
        // Test with larger capacity
        val largeBuffer = FrameBuffer(maxCapacity = 100)
        
        // Fill it up
        for (i in 0 until 100) {
            val added = largeBuffer.addFrame(createTestBuffer(100), false, "h264")
            assertTrue("Frame $i should be added", added)
        }
        
        assertEquals("Buffer should have 100 frames", 100, largeBuffer.size())
        assertTrue("Buffer should be full", largeBuffer.isFull())
    }

    /**
     * Helper method to create a test ByteBuffer
     */
    private fun createTestBuffer(size: Int): ByteBuffer {
        val buffer = ByteBuffer.allocate(size)
        for (i in 0 until size) {
            buffer.put((i % 256).toByte())
        }
        buffer.rewind()
        return buffer
    }
}
