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

        // Map all points - use local variable to enable smart cast
        val mapper = gestureMapper
        val devicePoints = if (mapper != null) {
            mapper.mapPoints(points)
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
     * Inject a key event.
     * 
     * For special keys like Backspace, Enter, Tab, Arrow keys, etc., we use
     * AccessibilityNodeInfo actions. For regular character keys, we inject 
     * the text into the focused input field.
     * 
     * @param action "down" or "up"
     * @param key The key value (e.g., "a", "Enter", "Backspace")
     * @param code The key code (e.g., "KeyA", "Enter", "Backspace")
     * @param shift Whether Shift is held
     * @param ctrl Whether Ctrl is held
     * @param alt Whether Alt is held
     * @param meta Whether Meta (Command) is held
     * @return true if the key was injected successfully
     */
    fun injectKey(
        action: String,
        key: String,
        code: String,
        shift: Boolean,
        ctrl: Boolean,
        alt: Boolean,
        meta: Boolean
    ): Boolean {
        // Only process key down events to avoid double input
        // (Most systems send both keydown and keyup)
        if (action != "down") {
            return true
        }

        Log.d(TAG, "Injecting key: key=$key, code=$code, shift=$shift, ctrl=$ctrl, alt=$alt, meta=$meta")

        // Handle special navigation/control keys first
        when (code) {
            "Backspace" -> {
                return injectBackspace()
            }
            "Enter" -> {
                return injectEnter()
            }
            "Tab" -> {
                return focusNextInput()
            }
            "Escape" -> {
                return performGlobalAction(GLOBAL_ACTION_BACK)
            }
            "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown" -> {
                return injectArrowKey(code)
            }
            "Home" -> {
                return performGlobalAction(GLOBAL_ACTION_HOME)
            }
        }

        // Handle Ctrl+key shortcuts
        if (ctrl) {
            when (key.lowercase()) {
                "a" -> return selectAll()
                "c" -> return copyText()
                "v" -> return pasteText()
                "x" -> return cutText()
                else -> {
                    Log.d(TAG, "Unhandled Ctrl+$key shortcut")
                    return false
                }
            }
        }

        // For regular character keys, inject the text
        if (key.length == 1) {
            return injectText(key)
        }

        // For space key
        if (code == "Space") {
            return injectText(" ")
        }

        Log.d(TAG, "Unhandled key: key=$key, code=$code")
        return false
    }

    /**
     * Inject text into the currently focused input field.
     * Falls back to finding any editable node if no focused input.
     */
    private fun injectText(text: String): Boolean {
        var focusedNode = findFocusedInput()
        
        // If no focused input, try to find any editable node
        if (focusedNode == null) {
            Log.d(TAG, "No focused input, searching for editable nodes...")
            focusedNode = findAnyEditableNode()
            if (focusedNode != null) {
                // Focus and click the editable node
                focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_FOCUS)
                focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
            }
        }
        
        if (focusedNode == null) {
            Log.w(TAG, "No editable input found for text injection")
            return false
        }

        try {
            // Get current text
            val currentText = focusedNode.text?.toString() ?: ""
            
            // Get cursor position if available
            val selectionStart = focusedNode.textSelectionStart
            val selectionEnd = focusedNode.textSelectionEnd
            
            val newText: String
            if (selectionStart >= 0 && selectionEnd >= 0) {
                // Replace selection or insert at cursor
                val prefix = if (selectionStart > 0 && selectionStart <= currentText.length) {
                    currentText.substring(0, selectionStart)
                } else {
                    currentText
                }
                val suffix = if (selectionEnd >= 0 && selectionEnd <= currentText.length) {
                    currentText.substring(selectionEnd)
                } else {
                    ""
                }
                newText = prefix + text + suffix
            } else {
                // Append to end
                newText = currentText + text
            }

            val args = android.os.Bundle()
            args.putCharSequence(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                newText
            )
            val result = focusedNode.performAction(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT,
                args
            )
            
            focusedNode.recycle()
            Log.d(TAG, "Injected text '$text', result=$result")
            return result
        } catch (e: Exception) {
            Log.e(TAG, "Error injecting text", e)
            focusedNode.recycle()
            return false
        }
    }

    /**
     * Handle backspace key - delete character before cursor.
     */
    private fun injectBackspace(): Boolean {
        val focusedNode = findFocusedInput()
        if (focusedNode == null) {
            Log.w(TAG, "No focused input found for backspace")
            return false
        }

        try {
            val currentText = focusedNode.text?.toString() ?: ""
            if (currentText.isEmpty()) {
                focusedNode.recycle()
                return true
            }

            val selectionStart = focusedNode.textSelectionStart
            val selectionEnd = focusedNode.textSelectionEnd

            val newText: String
            if (selectionStart >= 0 && selectionEnd >= 0 && selectionStart != selectionEnd) {
                // Delete selection
                val prefix = if (selectionStart > 0) currentText.substring(0, selectionStart) else ""
                val suffix = if (selectionEnd < currentText.length) currentText.substring(selectionEnd) else ""
                newText = prefix + suffix
            } else {
                // Delete character before cursor
                val cursor = if (selectionStart >= 0) selectionStart else currentText.length
                if (cursor <= 0) {
                    focusedNode.recycle()
                    return true
                }
                newText = currentText.substring(0, cursor - 1) + currentText.substring(cursor)
            }

            val args = android.os.Bundle()
            args.putCharSequence(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                newText
            )
            val result = focusedNode.performAction(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT,
                args
            )

            focusedNode.recycle()
            return result
        } catch (e: Exception) {
            Log.e(TAG, "Error handling backspace", e)
            focusedNode.recycle()
            return false
        }
    }

    /**
     * Handle Enter key - perform action on the input or add newline.
     */
    private fun injectEnter(): Boolean {
        val focusedNode = findFocusedInput()
        if (focusedNode == null) {
            // No input focused, simulate enter as a click
            Log.d(TAG, "No focused input for Enter, ignoring")
            return false
        }

        try {
            // Try to perform the input's default action (e.g., submit, search)
            if (focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY)) {
                focusedNode.recycle()
                return true
            }

            // Otherwise, just add a newline if it's a multiline input
            if (focusedNode.isMultiLine) {
                val result = injectText("\n")
                focusedNode.recycle()
                return result
            }

            // For single-line inputs, try to click the "Done" or similar button
            // by focusing the next element
            focusedNode.recycle()
            return focusNextInput()
        } catch (e: Exception) {
            Log.e(TAG, "Error handling Enter", e)
            focusedNode.recycle()
            return false
        }
    }

    /**
     * Handle arrow keys for cursor navigation.
     */
    private fun injectArrowKey(code: String): Boolean {
        val focusedNode = findFocusedInput() ?: return false
        
        try {
            val granularity = android.view.accessibility.AccessibilityNodeInfo.MOVEMENT_GRANULARITY_CHARACTER
            val args = android.os.Bundle()
            args.putInt(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_MOVEMENT_GRANULARITY_INT,
                granularity
            )

            val action = when (code) {
                "ArrowLeft" -> android.view.accessibility.AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY
                "ArrowRight" -> android.view.accessibility.AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY
                else -> {
                    // Up/Down for multiline - move by line
                    args.putInt(
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_MOVEMENT_GRANULARITY_INT,
                        android.view.accessibility.AccessibilityNodeInfo.MOVEMENT_GRANULARITY_LINE
                    )
                    if (code == "ArrowUp") {
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY
                    } else {
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY
                    }
                }
            }

            val result = focusedNode.performAction(action, args)
            focusedNode.recycle()
            return result
        } catch (e: Exception) {
            Log.e(TAG, "Error handling arrow key", e)
            focusedNode.recycle()
            return false
        }
    }

    /**
     * Focus the next input element.
     */
    private fun focusNextInput(): Boolean {
        val focusedNode = findFocusedInput()
        if (focusedNode != null) {
            val result = focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_NEXT_HTML_ELEMENT)
            focusedNode.recycle()
            if (result) return true
        }
        // Fallback to focus action
        return performGlobalAction(GLOBAL_ACTION_ACCESSIBILITY_BUTTON)
    }

    /**
     * Select all text in the focused input.
     */
    private fun selectAll(): Boolean {
        val focusedNode = findFocusedInput() ?: return false
        try {
            val text = focusedNode.text?.toString() ?: ""
            val args = android.os.Bundle()
            args.putInt(android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, 0)
            args.putInt(android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, text.length)
            val result = focusedNode.performAction(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_SELECTION,
                args
            )
            focusedNode.recycle()
            return result
        } catch (e: Exception) {
            Log.e(TAG, "Error selecting all", e)
            focusedNode.recycle()
            return false
        }
    }

    /**
     * Copy selected text.
     */
    private fun copyText(): Boolean {
        val focusedNode = findFocusedInput() ?: return false
        val result = focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_COPY)
        focusedNode.recycle()
        return result
    }

    /**
     * Paste text from clipboard.
     */
    private fun pasteText(): Boolean {
        val focusedNode = findFocusedInput() ?: return false
        val result = focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_PASTE)
        focusedNode.recycle()
        return result
    }

    /**
     * Cut selected text.
     */
    private fun cutText(): Boolean {
        val focusedNode = findFocusedInput() ?: return false
        val result = focusedNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CUT)
        focusedNode.recycle()
        return result
    }

    /**
     * Find the currently focused editable input field.
     */
    private fun findFocusedInput(): android.view.accessibility.AccessibilityNodeInfo? {
        return try {
            val node = rootInActiveWindow?.findFocus(android.view.accessibility.AccessibilityNodeInfo.FOCUS_INPUT)
            if (node != null && node.isEditable) {
                node
            } else {
                node?.recycle()
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error finding focused input", e)
            null
        }
    }
    
    /**
     * Find any editable node in the view hierarchy.
     */
    private fun findAnyEditableNode(): android.view.accessibility.AccessibilityNodeInfo? {
        return try {
            val root = rootInActiveWindow ?: return null
            val result = findEditableNodeRecursive(root)
            root.recycle()
            result
        } catch (e: Exception) {
            Log.e(TAG, "Error finding editable node", e)
            null
        }
    }
    
    /**
     * Recursively search for an editable node.
     */
    private fun findEditableNodeRecursive(node: android.view.accessibility.AccessibilityNodeInfo): android.view.accessibility.AccessibilityNodeInfo? {
        if (node.isEditable) {
            return android.view.accessibility.AccessibilityNodeInfo.obtain(node)
        }
        
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findEditableNodeRecursive(child)
            child.recycle()
            if (result != null) {
                return result
            }
        }
        return null
    }

    /**
     * Map coordinates from RC window to device screen.
     * 
     * The video stream may have letterboxing (black bars) if the device screen
     * aspect ratio differs from the video aspect ratio (1280x720 = 16:9).
     * 
     * @param x X coordinate in video space (0-1280)
     * @param y Y coordinate in video space (0-720)
     * @return Pair of device coordinates, or null if coordinates are in letterbox area
     */
    private fun mapCoordinates(x: Float, y: Float): Pair<Float, Float>? {
        val mapper = gestureMapper
        if (mapper != null) {
            val point = mapper.mapPoint(x, y)
            if (point == null) {
                Log.e(TAG, "Failed to map coordinates: ($x, $y)")
                return null
            }
            Log.d(TAG, "Mapped coordinates: ($x, $y) -> (${point.x}, ${point.y})")
            return Pair(point.x.toFloat(), point.y.toFloat())
        }
        
        // No mapper configured, use simple direct scaling
        // The video dimensions match the screen aspect ratio, so no letterboxing
        val displayMetrics = resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels.toFloat()
        val screenHeight = displayMetrics.heightPixels.toFloat()
        val screenAspect = screenWidth / screenHeight
        
        // Calculate video dimensions the same way ScreenCaptureManager does
        // Must match ScreenCaptureManager.kt constants exactly!
        val targetMaxWidth = 1280f
        val targetMaxHeight = 800f  // Note: This must match ScreenCaptureManager.TARGET_MAX_HEIGHT
        
        val videoWidth: Float
        val videoHeight: Float
        
        if (screenAspect >= 1) {
            // Landscape or square - width is the limiting factor
            videoWidth = targetMaxWidth
            videoHeight = (targetMaxWidth / screenAspect)
        } else {
            // Portrait - height is the limiting factor
            videoHeight = targetMaxHeight
            videoWidth = (targetMaxHeight * screenAspect)
        }
        
        // Round to even numbers (same as ScreenCaptureManager)
        val actualVideoWidth = ((videoWidth / 2).toInt() * 2).toFloat()
        val actualVideoHeight = ((videoHeight / 2).toInt() * 2).toFloat()
        
        // Simple direct scaling - video fills entire frame with no letterboxing
        val scaledX = (x / actualVideoWidth) * screenWidth
        val scaledY = (y / actualVideoHeight) * screenHeight
        
        Log.d(TAG, "Direct scaling: ($x, $y) -> ($scaledX, $scaledY) [video: ${actualVideoWidth}x${actualVideoHeight}, screen: ${screenWidth}x${screenHeight}]")
        return Pair(scaledX, scaledY)
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
            
            val resultCallback = object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    Log.i(TAG, "Gesture completed successfully")
                    callback?.onCompleted(gestureDescription)
                }
                
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    Log.w(TAG, "Gesture was cancelled")
                    callback?.onCancelled(gestureDescription)
                }
            }
            
            val dispatched = dispatchGesture(gesture, resultCallback, null)
            Log.d(TAG, "dispatchGesture returned: $dispatched")
            return dispatched
        } catch (e: Exception) {
            Log.e(TAG, "Error dispatching gesture", e)
            return false
        }
    }
}
