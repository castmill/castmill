package com.castmill.androidremote

import org.junit.Test
import org.junit.Assert.*
import org.junit.Before

/**
 * Unit tests for DiagnosticsManager.
 * 
 * Tests verify:
 * - Metrics collection (frames, drops, errors)
 * - FPS and bitrate calculation
 * - Connection tracking (heartbeats, reconnects)
 * - Jitter buffer statistics
 * - Diagnostics report generation
 */
class DiagnosticsManagerTest {

    private lateinit var diagnostics: DiagnosticsManager

    @Before
    fun setup() {
        diagnostics = DiagnosticsManager()
    }

    @Test
    fun testInitialState() {
        // Verify initial state
        assertEquals("Initial FPS should be 0", 0.0, diagnostics.getCurrentFps(), 0.01)
        assertEquals("Initial bitrate should be 0", 0.0, diagnostics.getCurrentBitrate(), 0.01)
        assertEquals("Initial uptime should be 0", 0L, diagnostics.getConnectionUptime())
        
        val stats = diagnostics.getSummaryStats()
        assertEquals("Initial frames should be 0", 0L, stats["frames_encoded"])
        assertEquals("Initial drops should be 0", 0L, stats["frames_dropped"])
    }

    @Test
    fun testConnectionTracking() {
        // Record connection start
        diagnostics.recordConnectionStart()
        
        // Wait a bit for uptime
        Thread.sleep(100)
        
        // Check uptime is non-zero
        assertTrue("Uptime should be > 0", diagnostics.getConnectionUptime() > 0)
        
        // Record disconnection
        diagnostics.recordDisconnection()
    }

    @Test
    fun testHeartbeatTracking() {
        val report = diagnostics.getDiagnosticsReport()
        val connectionStats = report["connection"] as? kotlinx.serialization.json.JsonObject
        val initialHeartbeats = connectionStats?.get("heartbeats_sent").toString().toInt()
        
        // Record some heartbeats
        diagnostics.recordHeartbeat()
        diagnostics.recordHeartbeat()
        diagnostics.recordHeartbeat()
        
        val updatedReport = diagnostics.getDiagnosticsReport()
        val updatedConnectionStats = updatedReport["connection"] as? kotlinx.serialization.json.JsonObject
        val finalHeartbeats = updatedConnectionStats?.get("heartbeats_sent").toString().toInt()
        
        assertEquals("Heartbeats should increment by 3", initialHeartbeats + 3, finalHeartbeats)
    }

    @Test
    fun testReconnectTracking() {
        // Record reconnect attempts
        diagnostics.recordReconnectAttempt()
        diagnostics.recordReconnectAttempt()
        
        // Record successful reconnect
        diagnostics.recordSuccessfulReconnect()
        
        val report = diagnostics.getDiagnosticsReport()
        val connectionStats = report["connection"] as? kotlinx.serialization.json.JsonObject
        
        val attempts = connectionStats?.get("reconnect_attempts").toString().toInt()
        val successful = connectionStats?.get("successful_reconnects").toString().toInt()
        
        assertEquals("Should have 2 reconnect attempts", 2, attempts)
        assertEquals("Should have 1 successful reconnect", 1, successful)
    }

    @Test
    fun testFrameEncoding() {
        // Record some frames
        diagnostics.recordFrameEncoded(1000, true) // Keyframe
        diagnostics.recordFrameEncoded(500, false) // P-frame
        diagnostics.recordFrameEncoded(500, false) // P-frame
        
        val report = diagnostics.getDiagnosticsReport()
        val videoStats = report["video"] as? kotlinx.serialization.json.JsonObject
        
        val framesEncoded = videoStats?.get("frames_encoded").toString().toLong()
        val keyframes = videoStats?.get("keyframes").toString().toLong()
        val totalBytes = videoStats?.get("total_bytes").toString().toLong()
        
        assertEquals("Should have 3 frames encoded", 3L, framesEncoded)
        assertEquals("Should have 1 keyframe", 1L, keyframes)
        assertEquals("Total bytes should be 2000", 2000L, totalBytes)
    }

    @Test
    fun testFrameDrops() {
        // Record some frames and drops
        diagnostics.recordFrameEncoded(1000, false)
        diagnostics.recordFrameDropped()
        diagnostics.recordFrameEncoded(1000, false)
        diagnostics.recordFrameDropped()
        
        val report = diagnostics.getDiagnosticsReport()
        val videoStats = report["video"] as? kotlinx.serialization.json.JsonObject
        
        val framesEncoded = videoStats?.get("frames_encoded").toString().toLong()
        val framesDropped = videoStats?.get("frames_dropped").toString().toLong()
        val dropRate = videoStats?.get("drop_rate").toString().toDouble()
        
        assertEquals("Should have 2 frames encoded", 2L, framesEncoded)
        assertEquals("Should have 2 frames dropped", 2L, framesDropped)
        assertEquals("Drop rate should be 50%", 50.0, dropRate, 0.01)
    }

    @Test
    fun testFpsCalculation() {
        // Simulate frames at ~10 fps
        val frameInterval = 100L // 100ms = 10fps
        
        for (i in 0 until 10) {
            diagnostics.recordFrameEncoded(1000, false)
            Thread.sleep(frameInterval)
        }
        
        // FPS should be around 10 (allowing some variance)
        val fps = diagnostics.getCurrentFps()
        assertTrue("FPS should be between 8 and 12", fps in 8.0..12.0)
    }

    @Test
    fun testBitrateCalculation() {
        // Record frames to calculate bitrate
        // 10 frames * 10000 bytes = 100000 bytes/sec = 800000 bps = 0.8 Mbps
        for (i in 0 until 10) {
            diagnostics.recordFrameEncoded(10000, false)
            Thread.sleep(100) // 100ms interval
        }
        
        // Wait for bitrate calculation window
        Thread.sleep(100)
        
        val bitrate = diagnostics.getCurrentBitrate()
        // Bitrate should be roughly 800000 bps (allowing variance)
        assertTrue("Bitrate should be > 0", bitrate > 0)
    }

    @Test
    fun testJitterTracking() {
        // Record jitter samples
        diagnostics.recordJitter(10L)
        diagnostics.recordJitter(20L)
        diagnostics.recordJitter(15L)
        
        val report = diagnostics.getDiagnosticsReport()
        val jitterStats = report["jitter"] as? kotlinx.serialization.json.JsonObject
        
        val avgJitter = jitterStats?.get("average_jitter_ms").toString().toDouble()
        
        // Average should be 15ms
        assertEquals("Average jitter should be 15ms", 15.0, avgJitter, 0.5)
    }

    @Test
    fun testJitterBufferStats() {
        // Record buffer events
        diagnostics.recordJitterBufferUnderrun()
        diagnostics.recordJitterBufferUnderrun()
        diagnostics.recordJitterBufferOverflow()
        
        val report = diagnostics.getDiagnosticsReport()
        val jitterStats = report["jitter"] as? kotlinx.serialization.json.JsonObject
        
        val underruns = jitterStats?.get("buffer_underruns").toString().toInt()
        val overflows = jitterStats?.get("buffer_overflows").toString().toInt()
        
        assertEquals("Should have 2 underruns", 2, underruns)
        assertEquals("Should have 1 overflow", 1, overflows)
    }

    @Test
    fun testErrorTracking() {
        // Record errors
        diagnostics.recordEncodingError()
        diagnostics.recordEncodingError()
        diagnostics.recordNetworkError()
        
        val report = diagnostics.getDiagnosticsReport()
        val errorStats = report["errors"] as? kotlinx.serialization.json.JsonObject
        
        val encodingErrors = errorStats?.get("encoding_errors").toString().toInt()
        val networkErrors = errorStats?.get("network_errors").toString().toInt()
        
        assertEquals("Should have 2 encoding errors", 2, encodingErrors)
        assertEquals("Should have 1 network error", 1, networkErrors)
    }

    @Test
    fun testReset() {
        // Record some metrics
        diagnostics.recordConnectionStart()
        diagnostics.recordHeartbeat()
        diagnostics.recordFrameEncoded(1000, true)
        diagnostics.recordFrameDropped()
        diagnostics.recordEncodingError()
        
        // Reset
        diagnostics.reset()
        
        // Verify everything is reset
        assertEquals("FPS should be 0 after reset", 0.0, diagnostics.getCurrentFps(), 0.01)
        assertEquals("Bitrate should be 0 after reset", 0.0, diagnostics.getCurrentBitrate(), 0.01)
        assertEquals("Uptime should be 0 after reset", 0L, diagnostics.getConnectionUptime())
        
        val stats = diagnostics.getSummaryStats()
        assertEquals("Frames should be 0 after reset", 0L, stats["frames_encoded"])
        assertEquals("Drops should be 0 after reset", 0L, stats["frames_dropped"])
    }

    @Test
    fun testGetSummaryStats() {
        // Record some data
        diagnostics.recordConnectionStart()
        diagnostics.recordFrameEncoded(1000, true)
        diagnostics.recordFrameEncoded(500, false)
        diagnostics.recordFrameDropped()
        diagnostics.recordReconnectAttempt()
        
        val stats = diagnostics.getSummaryStats()
        
        assertNotNull("Stats should not be null", stats)
        assertTrue("Stats should contain fps", stats.containsKey("fps"))
        assertTrue("Stats should contain bitrate_mbps", stats.containsKey("bitrate_mbps"))
        assertTrue("Stats should contain frames_encoded", stats.containsKey("frames_encoded"))
        assertTrue("Stats should contain frames_dropped", stats.containsKey("frames_dropped"))
        assertTrue("Stats should contain drop_rate", stats.containsKey("drop_rate"))
        assertTrue("Stats should contain uptime_seconds", stats.containsKey("uptime_seconds"))
        assertTrue("Stats should contain reconnects", stats.containsKey("reconnects"))
    }

    @Test
    fun testDiagnosticsReport() {
        // Record some data
        diagnostics.recordConnectionStart()
        diagnostics.recordHeartbeat()
        diagnostics.recordFrameEncoded(1000, true)
        diagnostics.recordJitter(10L)
        diagnostics.recordEncodingError()
        
        val report = diagnostics.getDiagnosticsReport()
        
        assertNotNull("Report should not be null", report)
        assertTrue("Report should contain connection stats", report.containsKey("connection"))
        assertTrue("Report should contain video stats", report.containsKey("video"))
        assertTrue("Report should contain jitter stats", report.containsKey("jitter"))
        assertTrue("Report should contain error stats", report.containsKey("errors"))
        assertTrue("Report should contain timestamp", report.containsKey("timestamp"))
    }

    @Test
    fun testDropRateCalculation() {
        // Test with no frames
        val stats1 = diagnostics.getSummaryStats()
        assertEquals("Drop rate should be 0 with no frames", 0.0, stats1["drop_rate"] as Double, 0.01)
        
        // Test with 50% drop rate
        diagnostics.recordFrameEncoded(1000, false)
        diagnostics.recordFrameDropped()
        
        val stats2 = diagnostics.getSummaryStats()
        assertEquals("Drop rate should be 50%", 50.0, stats2["drop_rate"] as Double, 0.01)
        
        // Test with 25% drop rate
        diagnostics.recordFrameEncoded(1000, false)
        diagnostics.recordFrameEncoded(1000, false)
        diagnostics.recordFrameEncoded(1000, false)
        
        val stats3 = diagnostics.getSummaryStats()
        assertEquals("Drop rate should be 20%", 20.0, stats3["drop_rate"] as Double, 0.01)
    }

    @Test
    fun testLogStats() {
        // This should not crash
        diagnostics.recordFrameEncoded(1000, false)
        diagnostics.logStats()
        
        // If we reach here without exception, test passes
        assertTrue("logStats should not crash", true)
    }
}
