package com.castmill.androidremote

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Point
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * RemoteAccessibilityService
 * 
 * Accessibility service that enables remote input control:
 * - Touch event injection via gestures (tap, long press, swipe)
 * - Multi-step gesture support for complex paths
 * - Coordinate mapping from RC window to device screen
 * - Global actions (back, home, recents, etc.)
 * 
 * Gesture Support:
 * - Tap: Single touch at a point (default 100ms duration)
 * - Long Press: Extended touch at a point (default 600ms duration)
 * - Swipe: Linear movement from one point to another
 * - Multi-step: Complex path through multiple points
 * 
 * Coordinate Mapping:
 * - Uses GestureMapper to transform RC coordinates to device coordinates
 * - Accounts for display rotation and aspect ratio differences
 * - Handles letterboxing/pillarboxing scenarios
 */
class RemoteAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "RemoteAccessService"
        private var instance: RemoteAccessibilityService? = null
        
        // Default gesture durations
        private const val TAP_DURATION_MS = 100L
        private const val LONG_PRESS_DURATION_MS = 600L
        private const val SWIPE_DURATION_MS = 300L
        
        /**
         * Get the current instance of the service if running
         */
        fun getInstance(): RemoteAccessibilityService? = instance
    }

    private var gestureMapper: GestureMapper? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        
        Log.i(TAG, "RemoteAccessibilityService connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need to process accessibility events for this use case
        // This service is only used for injecting input
    }

    override fun onInterrupt() {
        Log.w(TAG, "Service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        gestureMapper = null
        Log.i(TAG, "RemoteAccessibilityService destroyed")
    }

    /**
     * Initialize coordinate mapping for the remote control window.
     * 
     * @param rcWidth Width of the RC window in pixels
     * @param rcHeight Height of the RC window in pixels
     */
    fun initializeGestureMapper(rcWidth: Int, rcHeight: Int) {
        gestureMapper = GestureMapper(this, rcWidth, rcHeight)
        Log.i(TAG, "GestureMapper initialized: RC=${rcWidth}x${rcHeight}")
    }

    /**
     * Update display metrics (should be called when rotation changes).
     */
    fun updateDisplayMetrics() {
        gestureMapper?.updateDisplayMetrics()
    }

    /**
     * Inject a tap gesture at the specified coordinates.
     * 
     * @param x The x coordinate (device coordinates if mapper not set, RC coordinates otherwise)
     * @param y The y coordinate (device coordinates if mapper not set, RC coordinates otherwise)
     * @param durationMs Duration of the touch in milliseconds (default: 100ms)
     * @param callback Optional callback for gesture completion
     * @return true if gesture was dispatched, false otherwise
     */
    fun injectTap(
        x: Float, 
        y: Float, 
        durationMs: Long = TAP_DURATION_MS,
        callback: AccessibilityService.GestureResultCallback? = null
    ): Boolean {
        val (deviceX, deviceY) = mapCoordinates(x, y) ?: return false
        
        val path = Path().apply {
            moveTo(deviceX, deviceY)
        }
        
        return dispatchGestureInternal(path, 0, durationMs, callback)
    }

    /**
     * Inject a long press gesture at the specified coordinates.
     * 
     * @param x The x coordinate (device coordinates if mapper not set, RC coordinates otherwise)
     * @param y The y coordinate (device coordinates if mapper not set, RC coordinates otherwise)
     * @param durationMs Duration of the long press in milliseconds (default: 600ms)
     * @param callback Optional callback for gesture completion
     * @return true if gesture was dispatched, false otherwise
     */
    fun injectLongPress(
        x: Float, 
        y: Float, 
        durationMs: Long = LONG_PRESS_DURATION_MS,
        callback: AccessibilityService.GestureResultCallback? = null
    ): Boolean {
        val (deviceX, deviceY) = mapCoordinates(x, y) ?: return false
        
        val path = Path().apply {
            moveTo(deviceX, deviceY)
        }
        
        return dispatchGestureInternal(path, 0, durationMs, callback)
    }

    /**
     * Inject a swipe gesture between two points.
     * 
     * @param startX Start x coordinate
     * @param startY Start y coordinate
     * @param endX End x coordinate
     * @param endY End y coordinate
     * @param durationMs Duration of the swipe in milliseconds (default: 300ms)
     * @param callback Optional callback for gesture completion
     * @return true if gesture was dispatched, false otherwise
     */
    fun injectSwipe(
        startX: Float, 
        startY: Float, 
        endX: Float, 
        endY: Float, 
        durationMs: Long = SWIPE_DURATION_MS,
        callback: AccessibilityService.GestureResultCallback? = null
    ): Boolean {
        val (deviceStartX, deviceStartY) = mapCoordinates(startX, startY) ?: return false
        val (deviceEndX, deviceEndY) = mapCoordinates(endX, endY) ?: return false
        
        val path = Path().apply {
            moveTo(deviceStartX, deviceStartY)
            lineTo(deviceEndX, deviceEndY)
        }
        
        return dispatchGestureInternal(path, 0, durationMs, callback)
    }

    /**
     * Inject a multi-step gesture through multiple points.
     * 
     * This creates a continuous gesture that moves through all specified points,
     * useful for drawing or complex touch patterns.
     * 
     * @param points List of coordinate pairs [(x1,y1), (x2,y2), ...]
     * @param durationMs Total duration of the gesture in milliseconds
     * @param callback Optional callback for gesture completion
     * @return true if gesture was dispatched, false otherwise
     */
    fun injectMultiStepGesture(
        points: List<Pair<Float, Float>>,
        durationMs: Long,
        callback: AccessibilityService.GestureResultCallback? = null
    ): Boolean {
        if (points.isEmpty()) {
            Log.w(TAG, "Cannot inject gesture with no points")
            return false
        }

        // Map all points
        val devicePoints = if (gestureMapper != null) {
            gestureMapper?.mapPoints(points)
        } else {
            // No mapper, convert directly to Points
            points.map { (x, y) -> Point(x.toInt(), y.toInt()) }
        }

        if (devicePoints == null) {
            Log.e(TAG, "Failed to map gesture points")
            return false
        }

        // Build path through all points
        val path = Path().apply {
            val firstPoint = devicePoints[0]
            moveTo(firstPoint.x.toFloat(), firstPoint.y.toFloat())
            
            for (i in 1 until devicePoints.size) {
                val point = devicePoints[i]
                lineTo(point.x.toFloat(), point.y.toFloat())
            }
        }

        return dispatchGestureInternal(path, 0, durationMs, callback)
    }

    /**
     * Perform a global action (back, home, recents, etc.).
     * 
     * @param action The global action constant from AccessibilityService
     * @return true if the action was performed successfully
     */
    fun performAction(action: Int): Boolean {
        return performGlobalAction(action)
    }

    /**
     * Map coordinates from RC window to device screen.
     * 
     * @param x X coordinate
     * @param y Y coordinate
     * @return Pair of device coordinates, or original if no mapper is set
     */
    private fun mapCoordinates(x: Float, y: Float): Pair<Float, Float>? {
        val mapper = gestureMapper
        if (mapper != null) {
            val point = mapper.mapPoint(x, y)
            if (point == null) {
                Log.e(TAG, "Failed to map coordinates: ($x, $y)")
                return null
            }
            return Pair(point.x.toFloat(), point.y.toFloat())
        }
        
        // No mapper configured, use coordinates as-is
        return Pair(x, y)
    }

    /**
     * Dispatch a gesture with the given path and timing.
     * 
     * @param path The gesture path
     * @param startTime Start time offset in milliseconds
     * @param duration Duration in milliseconds
     * @param callback Optional callback for gesture completion
     * @return true if gesture was dispatched, false otherwise
     */
    private fun dispatchGestureInternal(
        path: Path,
        startTime: Long,
        duration: Long,
        callback: AccessibilityService.GestureResultCallback?
    ): Boolean {
        try {
            val gestureBuilder = GestureDescription.Builder()
            val stroke = GestureDescription.StrokeDescription(path, startTime, duration)
            val gesture = gestureBuilder.addStroke(stroke).build()
            
            return dispatchGesture(gesture, callback, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error dispatching gesture", e)
            return false
        }
    }
}
