package com.castmill.androidremote

import android.content.Context
import android.graphics.Point
import android.os.Build
import android.util.Log
import android.view.Surface
import android.view.WindowManager

/**
 * GestureMapper handles coordinate transformation between remote control (RC) window
 * coordinates and device screen coordinates.
 * 
 * This mapper accounts for:
 * - Different screen resolutions between RC window and device
 * - Display rotation (0°, 90°, 180°, 270°)
 * - Letterboxing/pillarboxing when aspect ratios differ
 * 
 * Coordinate Mapping Algorithm:
 * 1. Determine device screen dimensions (accounting for rotation)
 * 2. Calculate scaling factors between RC window and device screen
 * 3. Apply letterbox/pillarbox offsets if aspect ratios differ
 * 4. Transform coordinates through rotation matrix if device is rotated
 * 
 * RC Window Coordinates:
 * - Origin (0,0) at top-left
 * - X increases right, Y increases down
 * - Dimensions: rcWidth x rcHeight
 * 
 * Device Coordinates:
 * - Origin (0,0) at top-left (in current orientation)
 * - X increases right, Y increases down
 * - Dimensions vary by rotation
 */
class GestureMapper(
    private val context: Context,
    private val rcWidth: Int,
    private val rcHeight: Int
) {
    companion object {
        private const val TAG = "GestureMapper"
    }

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    
    // Device screen dimensions in current orientation
    private var deviceWidth: Int = 0
    private var deviceHeight: Int = 0
    
    // Display rotation
    private var rotation: Int = Surface.ROTATION_0
    
    // Letterbox/pillarbox offsets (in device coordinates)
    private var offsetX: Float = 0f
    private var offsetY: Float = 0f
    
    // Scaling factors
    private var scaleX: Float = 1f
    private var scaleY: Float = 1f

    init {
        updateDisplayMetrics()
    }

    /**
     * Update display metrics to reflect current screen state.
     * Should be called when rotation or screen dimensions change.
     */
    @Suppress("DEPRECATION")
    fun updateDisplayMetrics() {
        // Note: Using deprecated API for compatibility with minSdk 26
        // For API 30+, consider migrating to WindowMetrics when minSdk is raised
        val display = windowManager.defaultDisplay
        val size = Point()
        display.getRealSize(size)
        
        deviceWidth = size.x
        deviceHeight = size.y
        rotation = display.rotation
        
        calculateTransform()
        
        Log.d(TAG, "Display metrics updated: ${deviceWidth}x${deviceHeight}, rotation=$rotation")
    }

    /**
     * Calculate the coordinate transformation parameters.
     * 
     * This method determines the scaling factors and offsets needed to map
     * RC window coordinates to device coordinates, accounting for aspect ratio
     * differences through letterboxing/pillarboxing.
     */
    private fun calculateTransform() {
        // Calculate aspect ratios
        val rcAspect = rcWidth.toFloat() / rcHeight.toFloat()
        val deviceAspect = deviceWidth.toFloat() / deviceHeight.toFloat()
        
        if (rcAspect > deviceAspect) {
            // RC window is wider - letterboxing (black bars on top/bottom)
            scaleX = deviceWidth.toFloat() / rcWidth.toFloat()
            scaleY = scaleX
            
            val scaledHeight = rcHeight * scaleY
            offsetX = 0f
            offsetY = (deviceHeight - scaledHeight) / 2f
        } else if (rcAspect < deviceAspect) {
            // RC window is taller - pillarboxing (black bars on left/right)
            scaleY = deviceHeight.toFloat() / rcHeight.toFloat()
            scaleX = scaleY
            
            val scaledWidth = rcWidth * scaleX
            offsetX = (deviceWidth - scaledWidth) / 2f
            offsetY = 0f
        } else {
            // Aspect ratios match - simple scaling
            scaleX = deviceWidth.toFloat() / rcWidth.toFloat()
            scaleY = deviceHeight.toFloat() / rcHeight.toFloat()
            offsetX = 0f
            offsetY = 0f
        }
        
        Log.d(TAG, "Transform calculated: scale=($scaleX, $scaleY), offset=($offsetX, $offsetY)")
    }

    /**
     * Map a single point from RC window coordinates to device coordinates.
     * 
     * @param rcX X coordinate in RC window (0 to rcWidth-1)
     * @param rcY Y coordinate in RC window (0 to rcHeight-1)
     * @return Point with device coordinates, or null if out of bounds
     */
    fun mapPoint(rcX: Float, rcY: Float): Point? {
        // Validate input coordinates (exclusive upper bound)
        if (rcX < 0 || rcX >= rcWidth || rcY < 0 || rcY >= rcHeight) {
            Log.w(TAG, "RC coordinates out of bounds: ($rcX, $rcY)")
            return null
        }
        
        // Apply scaling and offset
        val deviceX = (rcX * scaleX + offsetX).toInt()
        val deviceY = (rcY * scaleY + offsetY).toInt()
        
        // Validate output coordinates
        if (deviceX < 0 || deviceX >= deviceWidth || deviceY < 0 || deviceY >= deviceHeight) {
            Log.w(TAG, "Mapped coordinates out of device bounds: ($deviceX, $deviceY)")
            return null
        }
        
        return Point(deviceX, deviceY)
    }

    /**
     * Map multiple points for multi-step gestures.
     * 
     * @param points List of RC coordinate pairs [(x1,y1), (x2,y2), ...]
     * @return List of device coordinate points, or null if any point is invalid
     */
    fun mapPoints(points: List<Pair<Float, Float>>): List<Point>? {
        val mappedPoints = mutableListOf<Point>()
        
        for ((rcX, rcY) in points) {
            val devicePoint = mapPoint(rcX, rcY) ?: return null
            mappedPoints.add(devicePoint)
        }
        
        return mappedPoints
    }

    /**
     * Get current device dimensions.
     * 
     * @return Pair of (width, height) in pixels
     */
    fun getDeviceDimensions(): Pair<Int, Int> {
        return Pair(deviceWidth, deviceHeight)
    }

    /**
     * Get current display rotation.
     * 
     * @return One of Surface.ROTATION_0, ROTATION_90, ROTATION_180, ROTATION_270
     */
    fun getRotation(): Int {
        return rotation
    }

    /**
     * Get RC window dimensions.
     * 
     * @return Pair of (width, height) in pixels
     */
    fun getRCDimensions(): Pair<Int, Int> {
        return Pair(rcWidth, rcHeight)
    }

    /**
     * Get current scaling factors.
     * 
     * @return Pair of (scaleX, scaleY)
     */
    fun getScaleFactors(): Pair<Float, Float> {
        return Pair(scaleX, scaleY)
    }

    /**
     * Get current letterbox/pillarbox offsets.
     * 
     * @return Pair of (offsetX, offsetY) in pixels
     */
    fun getOffsets(): Pair<Float, Float> {
        return Pair(offsetX, offsetY)
    }
}
