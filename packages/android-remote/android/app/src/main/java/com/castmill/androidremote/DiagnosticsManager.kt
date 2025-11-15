package com.castmill.androidremote

import android.util.Log
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * DiagnosticsManager collects and reports internal metrics for monitoring and troubleshooting.
 * 
 * Tracks:
 * - Connection metrics (heartbeats, reconnects, connection duration)
 * - Video encoding metrics (FPS, bitrate, frame drops, keyframes)
 * - Jitter buffer statistics
 * - Error counts and types
 * 
 * Thread-safe for concurrent access from multiple components.
 */
class DiagnosticsManager {
    companion object {
        private const val TAG = "DiagnosticsManager"
        
        // Metrics calculation intervals (ms)
        private const val FPS_CALCULATION_WINDOW_MS = 1000L
        private const val BITRATE_CALCULATION_WINDOW_MS = 1000L
    }

    // Connection metrics
    private val heartbeatsSent = AtomicInteger(0)
    private val reconnectAttempts = AtomicInteger(0)
    private val successfulReconnects = AtomicInteger(0)
    private var connectionStartTime: Long = 0
    private var lastDisconnectTime: Long = 0
    
    // Video encoding metrics
    private val totalFramesEncoded = AtomicLong(0)
    private val totalFramesDropped = AtomicLong(0)
    private val totalKeyFrames = AtomicLong(0)
    private val totalBytesEncoded = AtomicLong(0)
    
    // FPS tracking
    private val frameTimestampsLock = Any()
    private var frameTimestamps = mutableListOf<Long>()
    private var lastFpsCalculation = 0L
    private var currentFps = 0.0
    
    // Bitrate tracking
    private var bytesInWindow = AtomicLong(0)
    private var lastBitrateCalculation = 0L
    private var currentBitrate = 0.0 // bits per second
    
    // Jitter buffer stats
    private val jitterBufferUnderruns = AtomicInteger(0)
    private val jitterBufferOverflows = AtomicInteger(0)
    private val jitterSamplesLock = Any()
    private var averageJitterMs = 0.0
    private val jitterSamples = mutableListOf<Long>()
    private val maxJitterSamples = 100
    
    // Error tracking
    private val encodingErrors = AtomicInteger(0)
    private val networkErrors = AtomicInteger(0)
    
    /**
     * Record a connection event
     */
    fun recordConnectionStart() {
        connectionStartTime = System.currentTimeMillis()
        Log.d(TAG, "Connection started at $connectionStartTime")
    }
    
    /**
     * Record a disconnection event
     */
    fun recordDisconnection() {
        lastDisconnectTime = System.currentTimeMillis()
        Log.d(TAG, "Disconnection recorded at $lastDisconnectTime")
    }
    
    /**
     * Record a heartbeat sent
     */
    fun recordHeartbeat() {
        heartbeatsSent.incrementAndGet()
    }
    
    /**
     * Record a reconnection attempt
     */
    fun recordReconnectAttempt() {
        reconnectAttempts.incrementAndGet()
    }
    
    /**
     * Record a successful reconnection
     */
    fun recordSuccessfulReconnect() {
        successfulReconnects.incrementAndGet()
        recordConnectionStart() // Reset connection start time
    }
    
    /**
     * Record an encoded video frame
     */
    fun recordFrameEncoded(frameSize: Int, isKeyFrame: Boolean) {
        val now = System.currentTimeMillis()
        
        totalFramesEncoded.incrementAndGet()
        totalBytesEncoded.addAndGet(frameSize.toLong())
        
        if (isKeyFrame) {
            totalKeyFrames.incrementAndGet()
        }
        
        // Track frame timestamp for FPS calculation
        synchronized(frameTimestampsLock) {
            frameTimestamps.add(now)
            
            // Calculate FPS every second
            if (now - lastFpsCalculation >= FPS_CALCULATION_WINDOW_MS) {
                calculateFps(now)
                lastFpsCalculation = now
            }
        }
        
        // Track bytes for bitrate calculation
        bytesInWindow.addAndGet(frameSize.toLong())
        if (now - lastBitrateCalculation >= BITRATE_CALCULATION_WINDOW_MS) {
            calculateBitrate(now)
            lastBitrateCalculation = now
        }
    }
    
    /**
     * Record a dropped frame
     */
    fun recordFrameDropped() {
        totalFramesDropped.incrementAndGet()
        Log.d(TAG, "Frame dropped. Total drops: ${totalFramesDropped.get()}")
    }
    
    /**
     * Record jitter measurement (time delta between expected and actual frame arrival)
     */
    fun recordJitter(jitterMs: Long) {
        synchronized(jitterSamplesLock) {
            jitterSamples.add(jitterMs)
            
            // Keep only recent samples
            if (jitterSamples.size > maxJitterSamples) {
                jitterSamples.removeAt(0)
            }
            
            // Calculate average jitter
            averageJitterMs = jitterSamples.average()
        }
    }
    
    /**
     * Record jitter buffer underrun (buffer empty)
     */
    fun recordJitterBufferUnderrun() {
        jitterBufferUnderruns.incrementAndGet()
    }
    
    /**
     * Record jitter buffer overflow (buffer full)
     */
    fun recordJitterBufferOverflow() {
        jitterBufferOverflows.incrementAndGet()
    }
    
    /**
     * Record an encoding error
     */
    fun recordEncodingError() {
        encodingErrors.incrementAndGet()
        Log.w(TAG, "Encoding error recorded. Total: ${encodingErrors.get()}")
    }
    
    /**
     * Record a network error
     */
    fun recordNetworkError() {
        networkErrors.incrementAndGet()
        Log.w(TAG, "Network error recorded. Total: ${networkErrors.get()}")
    }
    
    /**
     * Calculate current FPS based on frame timestamps
     */
    private fun calculateFps(currentTime: Long) {
        synchronized(frameTimestampsLock) {
            // Remove timestamps older than 1 second
            val cutoffTime = currentTime - FPS_CALCULATION_WINDOW_MS
            frameTimestamps.removeAll { it < cutoffTime }
            
            // Calculate FPS
            currentFps = frameTimestamps.size.toDouble()
            
            Log.d(TAG, "Current FPS: $currentFps")
        }
    }
    
    /**
     * Calculate current bitrate based on bytes in window
     */
    private fun calculateBitrate(currentTime: Long) {
        val bytes = bytesInWindow.getAndSet(0)
        // Convert bytes/second to bits/second
        currentBitrate = (bytes * 8.0) / (BITRATE_CALCULATION_WINDOW_MS / 1000.0)
        
        Log.d(TAG, "Current bitrate: ${currentBitrate / 1_000_000} Mbps")
    }
    
    /**
     * Get current FPS
     */
    fun getCurrentFps(): Double = currentFps
    
    /**
     * Get current bitrate (bits per second)
     */
    fun getCurrentBitrate(): Double = currentBitrate
    
    /**
     * Get connection uptime in seconds
     */
    fun getConnectionUptime(): Long {
        return if (connectionStartTime > 0) {
            (System.currentTimeMillis() - connectionStartTime) / 1000
        } else {
            0
        }
    }
    
    /**
     * Get comprehensive diagnostics report as JSON object
     */
    fun getDiagnosticsReport() = buildJsonObject {
        // Connection metrics
        put("connection", buildJsonObject {
            put("uptime_seconds", getConnectionUptime())
            put("heartbeats_sent", heartbeatsSent.get())
            put("reconnect_attempts", reconnectAttempts.get())
            put("successful_reconnects", successfulReconnects.get())
        })
        
        // Video encoding metrics
        put("video", buildJsonObject {
            put("frames_encoded", totalFramesEncoded.get())
            put("frames_dropped", totalFramesDropped.get())
            put("keyframes", totalKeyFrames.get())
            put("total_bytes", totalBytesEncoded.get())
            put("current_fps", currentFps)
            put("current_bitrate_bps", currentBitrate)
            put("current_bitrate_mbps", currentBitrate / 1_000_000.0)
            put("drop_rate", calculateDropRate())
        })
        
        // Jitter buffer stats
        put("jitter", buildJsonObject {
            put("average_jitter_ms", averageJitterMs)
            put("buffer_underruns", jitterBufferUnderruns.get())
            put("buffer_overflows", jitterBufferOverflows.get())
        })
        
        // Error metrics
        put("errors", buildJsonObject {
            put("encoding_errors", encodingErrors.get())
            put("network_errors", networkErrors.get())
        })
        
        // Metadata
        put("timestamp", System.currentTimeMillis())
    }
    
    /**
     * Get summary statistics as a map
     */
    fun getSummaryStats(): Map<String, Any> {
        return mapOf(
            "fps" to currentFps,
            "bitrate_mbps" to (currentBitrate / 1_000_000.0),
            "frames_encoded" to totalFramesEncoded.get(),
            "frames_dropped" to totalFramesDropped.get(),
            "drop_rate" to calculateDropRate(),
            "uptime_seconds" to getConnectionUptime(),
            "reconnects" to reconnectAttempts.get()
        )
    }
    
    /**
     * Calculate frame drop rate as percentage
     */
    private fun calculateDropRate(): Double {
        val total = totalFramesEncoded.get() + totalFramesDropped.get()
        return if (total > 0) {
            (totalFramesDropped.get().toDouble() / total.toDouble()) * 100.0
        } else {
            0.0
        }
    }
    
    /**
     * Reset all metrics
     */
    fun reset() {
        heartbeatsSent.set(0)
        reconnectAttempts.set(0)
        successfulReconnects.set(0)
        connectionStartTime = 0
        lastDisconnectTime = 0
        
        totalFramesEncoded.set(0)
        totalFramesDropped.set(0)
        totalKeyFrames.set(0)
        totalBytesEncoded.set(0)
        
        synchronized(frameTimestampsLock) {
            frameTimestamps.clear()
            lastFpsCalculation = 0
            currentFps = 0.0
        }
        
        bytesInWindow.set(0)
        lastBitrateCalculation = 0
        currentBitrate = 0.0
        
        jitterBufferUnderruns.set(0)
        jitterBufferOverflows.set(0)
        synchronized(jitterSamplesLock) {
            jitterSamples.clear()
            averageJitterMs = 0.0
        }
        
        encodingErrors.set(0)
        networkErrors.set(0)
        
        Log.i(TAG, "Diagnostics reset")
    }
    
    /**
     * Log current statistics
     */
    fun logStats() {
        val stats = getSummaryStats()
        Log.i(TAG, "Diagnostics: FPS=${stats["fps"]}, " +
                "Bitrate=${stats["bitrate_mbps"]}Mbps, " +
                "Frames=${stats["frames_encoded"]}, " +
                "Drops=${stats["frames_dropped"]} (${stats["drop_rate"]}%), " +
                "Uptime=${stats["uptime_seconds"]}s, " +
                "Reconnects=${stats["reconnects"]}")
    }
}
