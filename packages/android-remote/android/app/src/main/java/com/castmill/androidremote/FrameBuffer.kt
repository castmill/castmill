package com.castmill.androidremote

import android.util.Log
import java.nio.ByteBuffer
import java.util.LinkedList
import java.util.concurrent.atomic.AtomicInteger

/**
 * FrameBuffer manages video frame buffering with backpressure handling.
 * 
 * Features:
 * - Bounded buffer with configurable capacity
 * - Backpressure: drops oldest P-frames when buffer is full
 * - Always keeps keyframes (I-frames) to maintain stream integrity
 * - Thread-safe for concurrent producer/consumer access
 * 
 * @param maxCapacity Maximum number of frames to buffer
 * @param onFrameDropped Callback when a frame is dropped due to backpressure
 */
class FrameBuffer(
    private val maxCapacity: Int = 30, // Default: ~2 seconds at 15fps
    private val onFrameDropped: () -> Unit = {}
) {
    companion object {
        private const val TAG = "FrameBuffer"
    }
    
    /**
     * Frame data container
     */
    data class Frame(
        val buffer: ByteBuffer,
        val isKeyFrame: Boolean,
        val codecType: String,
        val timestamp: Long = System.currentTimeMillis()
    )
    
    private val queue = LinkedList<Frame>()
    private val queueLock = Any()
    private val currentSize = AtomicInteger(0)
    
    /**
     * Add a frame to the buffer with backpressure handling
     * 
     * @param buffer Frame data
     * @param isKeyFrame Whether this is a keyframe (I-frame)
     * @param codecType Codec type (h264, mjpeg)
     * @return true if frame was added, false if dropped
     */
    fun addFrame(buffer: ByteBuffer, isKeyFrame: Boolean, codecType: String): Boolean {
        synchronized(queueLock) {
            // Always add keyframes - they are critical for stream integrity
            if (isKeyFrame) {
                val frame = Frame(buffer, isKeyFrame, codecType)
                queue.offer(frame)
                currentSize.incrementAndGet()
                Log.d(TAG, "Added keyframe. Buffer size: ${currentSize.get()}/$maxCapacity")
                
                // If buffer exceeded capacity after adding keyframe, drop oldest P-frame
                if (currentSize.get() > maxCapacity) {
                    dropOldestPFrame()
                }
                
                return true
            }
            
            // Check capacity before adding P-frame
            if (currentSize.get() >= maxCapacity) {
                // Buffer is full - drop oldest P-frame to make room
                if (dropOldestPFrame()) {
                    // Successfully dropped a P-frame, now add the new frame
                    val frame = Frame(buffer, isKeyFrame, codecType)
                    queue.offer(frame)
                    currentSize.incrementAndGet()
                    Log.d(TAG, "Added P-frame after drop. Buffer size: ${currentSize.get()}/$maxCapacity")
                    return true
                } else {
                    // Could not drop a P-frame (buffer may contain only keyframes)
                    // Drop the new frame instead
                    onFrameDropped()
                    Log.w(TAG, "Dropped new P-frame (buffer full with keyframes). Size: ${currentSize.get()}")
                    return false
                }
            }
            
            // Buffer has space - add the frame
            val frame = Frame(buffer, isKeyFrame, codecType)
            queue.offer(frame)
            currentSize.incrementAndGet()
            Log.v(TAG, "Added P-frame. Buffer size: ${currentSize.get()}/$maxCapacity")
            return true
        }
    }
    
    /**
     * Get the next frame from the buffer
     * 
     * @return Frame or null if buffer is empty
     */
    fun getFrame(): Frame? {
        synchronized(queueLock) {
            val frame = queue.poll()
            if (frame != null) {
                currentSize.decrementAndGet()
                Log.v(TAG, "Retrieved frame. Buffer size: ${currentSize.get()}/$maxCapacity")
            }
            return frame
        }
    }
    
    /**
     * Peek at the next frame without removing it
     * 
     * @return Frame or null if buffer is empty
     */
    fun peekFrame(): Frame? {
        synchronized(queueLock) {
            return queue.peek()
        }
    }
    
    /**
     * Drop the oldest P-frame (non-keyframe) from the buffer
     * Must be called within synchronized(queueLock) block
     * 
     * @return true if a P-frame was dropped, false otherwise
     */
    private fun dropOldestPFrame(): Boolean {
        // Use iterator to find and remove the first P-frame efficiently
        val iterator = queue.iterator()
        while (iterator.hasNext()) {
            val frame = iterator.next()
            if (!frame.isKeyFrame) {
                iterator.remove()
                currentSize.decrementAndGet()
                onFrameDropped()
                
                Log.d(TAG, "Dropped oldest P-frame. Buffer size: ${currentSize.get()}/$maxCapacity")
                return true
            }
        }
        
        // No P-frames found
        Log.d(TAG, "No P-frames to drop. Buffer contains only keyframes.")
        return false
    }
    
    /**
     * Get current buffer size
     */
    fun size(): Int = currentSize.get()
    
    /**
     * Check if buffer is empty
     */
    fun isEmpty(): Boolean {
        synchronized(queueLock) {
            return queue.isEmpty()
        }
    }
    
    /**
     * Check if buffer is full
     */
    fun isFull(): Boolean = currentSize.get() >= maxCapacity
    
    /**
     * Get buffer utilization as percentage
     */
    fun getUtilization(): Double {
        return (currentSize.get().toDouble() / maxCapacity.toDouble()) * 100.0
    }
    
    /**
     * Clear all frames from the buffer
     */
    fun clear() {
        synchronized(queueLock) {
            queue.clear()
            currentSize.set(0)
        }
        Log.i(TAG, "Buffer cleared")
    }
    
    /**
     * Get buffer statistics
     */
    fun getStats(): Map<String, Any> {
        return mapOf(
            "size" to currentSize.get(),
            "capacity" to maxCapacity,
            "utilization_percent" to getUtilization(),
            "is_full" to isFull(),
            "is_empty" to isEmpty()
        )
    }
}
