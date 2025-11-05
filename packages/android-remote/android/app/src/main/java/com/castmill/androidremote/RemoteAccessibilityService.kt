package com.castmill.androidremote

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent

/**
 * RemoteAccessibilityService
 * 
 * Accessibility service that enables remote input control:
 * - Touch event injection via gestures
 * - Key event injection
 * - Global actions (back, home, recents, etc.)
 */
class RemoteAccessibilityService : AccessibilityService() {

    companion object {
        private var instance: RemoteAccessibilityService? = null
        
        /**
         * Get the current instance of the service if running
         */
        fun getInstance(): RemoteAccessibilityService? = instance
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        
        // Service is now connected and ready to handle remote input
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need to process accessibility events for this use case
        // This service is only used for injecting input
    }

    override fun onInterrupt() {
        // Handle interruption if needed
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    /**
     * Inject a touch event at the specified coordinates
     * 
     * @param x The x coordinate
     * @param y The y coordinate
     * @param durationMs Duration of the touch in milliseconds
     */
    fun injectTouch(x: Float, y: Float, durationMs: Long = 100) {
        val path = Path().apply {
            moveTo(x, y)
        }
        
        val gestureBuilder = GestureDescription.Builder()
        val gesture = gestureBuilder
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
        
        dispatchGesture(gesture, null, null)
    }

    /**
     * Inject a swipe gesture
     * 
     * @param startX Start x coordinate
     * @param startY Start y coordinate
     * @param endX End x coordinate
     * @param endY End y coordinate
     * @param durationMs Duration of the swipe in milliseconds
     */
    fun injectSwipe(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long = 300) {
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        
        val gestureBuilder = GestureDescription.Builder()
        val gesture = gestureBuilder
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
        
        dispatchGesture(gesture, null, null)
    }

    /**
     * Perform a global action (back, home, recents, etc.)
     * 
     * @param action The global action constant from AccessibilityService
     */
    fun performGlobalAction(action: Int): Boolean {
        return performGlobalAction(action)
    }
}
