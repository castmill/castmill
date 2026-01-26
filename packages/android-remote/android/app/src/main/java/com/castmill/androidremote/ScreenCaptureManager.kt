package com.castmill.androidremote

import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaCodec
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import java.nio.ByteBuffer

/**
 * ScreenCaptureManager handles screen capture using MediaProjection.
 * 
 * This manager:
 * - Creates VirtualDisplay from MediaProjection
 * - Manages video encoding (H.264 or MJPEG fallback)
 * - Streams encoded frames via callback
 * - Handles lifecycle and resource cleanup
 * - Integrates with DiagnosticsManager for metrics
 * - Implements backpressure handling with FrameBuffer
 * 
 * @param context Application context
 * @param resultCode Result code from MediaProjection permission request
 * @param data Intent data from MediaProjection permission request
 * @param onFrameEncoded Callback when a frame is encoded and ready to send
 * @param onError Callback when an error occurs
 * @param diagnosticsManager Optional diagnostics manager for metrics collection
 */
class ScreenCaptureManager(
    private val context: Context,
    private val resultCode: Int,
    private val data: Intent,
    private val onFrameEncoded: (ByteBuffer, Boolean, String) -> Unit, // data, isKeyFrame, codecType
    private val onError: (Exception) -> Unit,
    private val diagnosticsManager: DiagnosticsManager? = null
) {
    companion object {
        private const val TAG = "ScreenCaptureManager"
        private const val DISPLAY_NAME = "CastmillScreenCapture"
        
        // Encoding parameters - base dimensions (will be adjusted to match screen aspect ratio)
        private const val TARGET_MAX_WIDTH = 1280
        private const val TARGET_MAX_HEIGHT = 800
        private const val H264_FRAME_RATE = 15
        private const val H264_BITRATE = 2_000_000 // 2 Mbps
        private const val MJPEG_FRAME_RATE = 5
        private const val MJPEG_QUALITY = 75
        
        // Drain interval for H.264 encoder (ms)
        private const val DRAIN_INTERVAL_MS = 33L // ~30fps drain rate
        
        // Frame buffer capacity (frames)
        private const val FRAME_BUFFER_CAPACITY = 30 // ~2 seconds at 15fps
    }
    
    // Actual capture dimensions (calculated based on screen aspect ratio)
    private var captureWidth = TARGET_MAX_WIDTH
    private var captureHeight = TARGET_MAX_HEIGHT

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var videoEncoder: VideoEncoder? = null
    private var mjpegEncoder: MjpegEncoder? = null
    private var encoderThread: HandlerThread? = null
    private var encoderHandler: Handler? = null
    private var isCapturing = false
    // Use MJPEG by default since it can be displayed directly in browser without WebCodecs
    // Set to true if H.264 WebCodecs decoder is implemented in dashboard
    private var useH264 = false
    private var drainRunnable: Runnable? = null
    private val frameBuffer = FrameBuffer(
        maxCapacity = FRAME_BUFFER_CAPACITY,
        onFrameDropped = {
            diagnosticsManager?.recordFrameDropped()
        }
    )
    
    /**
     * Calculate capture dimensions that match the screen's aspect ratio.
     * This prevents black bars (letterboxing/pillarboxing) in the captured video.
     */
    private fun calculateCaptureDimensions() {
        val metrics = getDisplayMetrics()
        val screenWidth = metrics.widthPixels.toFloat()
        val screenHeight = metrics.heightPixels.toFloat()
        val screenAspect = screenWidth / screenHeight
        
        // Calculate dimensions that fit within max bounds while preserving aspect ratio
        if (screenAspect >= 1) {
            // Landscape or square - width is the limiting factor
            captureWidth = TARGET_MAX_WIDTH
            captureHeight = (TARGET_MAX_WIDTH / screenAspect).toInt()
            // Ensure height is even (required for video encoding)
            captureHeight = (captureHeight / 2) * 2
        } else {
            // Portrait - height is the limiting factor
            captureHeight = TARGET_MAX_HEIGHT
            captureWidth = (TARGET_MAX_HEIGHT * screenAspect).toInt()
            // Ensure width is even (required for video encoding)
            captureWidth = (captureWidth / 2) * 2
        }
        
        Log.i(TAG, "Screen: ${screenWidth.toInt()}x${screenHeight.toInt()} (aspect: $screenAspect), Capture: ${captureWidth}x${captureHeight}")
    }

    /**
     * Start screen capture and encoding.
     * @return true if capture started successfully, false otherwise
     */
    fun start(): Boolean {
        try {
            // Calculate capture dimensions based on screen aspect ratio
            calculateCaptureDimensions()
            
            // Get MediaProjection
            val projectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, data)
            
            if (mediaProjection == null) {
                Log.e(TAG, "Failed to obtain MediaProjection")
                onError(Exception("Failed to obtain MediaProjection"))
                return false
            }

            // Register callback for projection stop
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.i(TAG, "MediaProjection stopped")
                    stop()
                }
            }, null)

            // Try H.264 encoding first, fallback to MJPEG if it fails
            val encoderStarted = if (useH264) {
                startH264Encoding()
            } else {
                startMjpegEncoding()
            }

            if (!encoderStarted) {
                Log.w(TAG, "Failed to start encoder")
                return false
            }

            isCapturing = true
            Log.i(TAG, "Screen capture started with ${if (useH264) "H.264" else "MJPEG"} encoding")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start screen capture", e)
            onError(e)
            return false
        }
    }

    /**
     * Start H.264 encoding with fallback to MJPEG on failure.
     */
    private fun startH264Encoding(): Boolean {
        try {
            // Create encoder thread
            encoderThread = HandlerThread("H264EncoderThread").apply {
                start()
            }
            encoderHandler = Handler(encoderThread!!.looper)

            // Create video encoder
            videoEncoder = VideoEncoder(
                width = captureWidth,
                height = captureHeight,
                frameRate = H264_FRAME_RATE,
                bitrate = H264_BITRATE,
                onEncodedFrame = { buffer, bufferInfo, isKeyFrame ->
                    // Record frame in diagnostics
                    diagnosticsManager?.recordFrameEncoded(bufferInfo.size, isKeyFrame)
                    
                    // Add to frame buffer with backpressure handling
                    val added = frameBuffer.addFrame(buffer, isKeyFrame, "h264")
                    if (added) {
                        // Send buffered frames to avoid blocking encoder
                        sendBufferedFrames()
                    }
                },
                onError = { exception ->
                    Log.e(TAG, "H.264 encoder error, falling back to MJPEG", exception)
                    diagnosticsManager?.recordEncodingError()
                    // Fallback to MJPEG - execute synchronously to avoid race with handler shutdown
                    stopH264Encoding()
                    useH264 = false
                    startMjpegEncoding()
                }
            )

            // Initialize encoder
            if (!videoEncoder!!.start()) {
                Log.w(TAG, "Failed to initialize H.264 encoder, falling back to MJPEG")
                videoEncoder = null
                useH264 = false
                return startMjpegEncoding()
            }

            // Get input surface
            val inputSurface = videoEncoder?.inputSurface
            if (inputSurface == null) {
                Log.w(TAG, "Failed to get input surface, falling back to MJPEG")
                videoEncoder?.stop()
                videoEncoder = null
                useH264 = false
                return startMjpegEncoding()
            }

            // Create virtual display
            val metrics = getDisplayMetrics()
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                DISPLAY_NAME,
                captureWidth,
                captureHeight,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                inputSurface,
                null,
                encoderHandler
            )

            if (virtualDisplay == null) {
                Log.e(TAG, "Failed to create VirtualDisplay")
                videoEncoder?.stop()
                videoEncoder = null
                return false
            }

            // Start the encoder
            videoEncoder?.startEncoder()

            // Start draining encoder periodically
            drainRunnable = object : Runnable {
                override fun run() {
                    videoEncoder?.drainEncoder()
                    encoderHandler?.postDelayed(this, DRAIN_INTERVAL_MS)
                }
            }
            encoderHandler?.post(drainRunnable!!)

            Log.i(TAG, "H.264 encoding started")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting H.264 encoding, falling back to MJPEG", e)
            stopH264Encoding()
            useH264 = false
            return startMjpegEncoding()
        }
    }

    /**
     * Start MJPEG encoding as fallback.
     */
    private fun startMjpegEncoding(): Boolean {
        try {
            // Create MJPEG encoder
            mjpegEncoder = MjpegEncoder(
                width = captureWidth,
                height = captureHeight,
                frameRate = MJPEG_FRAME_RATE,
                quality = MJPEG_QUALITY,
                onEncodedFrame = { buffer, timestamp, isKeyFrame ->
                    // Record frame in diagnostics
                    diagnosticsManager?.recordFrameEncoded(buffer.remaining(), isKeyFrame)
                    
                    // Add to frame buffer with backpressure handling
                    val added = frameBuffer.addFrame(buffer, isKeyFrame, "mjpeg")
                    if (added) {
                        sendBufferedFrames()
                    }
                },
                onError = { exception ->
                    Log.e(TAG, "MJPEG encoder error", exception)
                    diagnosticsManager?.recordEncodingError()
                    onError(exception)
                }
            )

            // Initialize encoder
            if (!mjpegEncoder!!.start()) {
                Log.e(TAG, "Failed to initialize MJPEG encoder")
                mjpegEncoder = null
                return false
            }

            // Get surface
            val surface = mjpegEncoder?.getSurface()
            if (surface == null) {
                Log.e(TAG, "Failed to get MJPEG surface")
                mjpegEncoder?.stop()
                mjpegEncoder = null
                return false
            }

            // Create virtual display
            val metrics = getDisplayMetrics()
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                DISPLAY_NAME,
                captureWidth,
                captureHeight,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                surface,
                null,
                null
            )

            if (virtualDisplay == null) {
                Log.e(TAG, "Failed to create VirtualDisplay for MJPEG")
                mjpegEncoder?.stop()
                mjpegEncoder = null
                return false
            }

            Log.i(TAG, "MJPEG encoding started")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting MJPEG encoding", e)
            onError(e)
            return false
        }
    }

    /**
     * Send buffered frames to the output callback
     * Note: This drains the entire buffer synchronously. In production, consider
     * implementing rate limiting or async handling if onFrameEncoded blocks.
     */
    private fun sendBufferedFrames() {
        // Limit number of frames sent per call to prevent blocking encoder thread
        var framesSent = 0
        val maxFramesPerBatch = 5
        
        while (!frameBuffer.isEmpty() && framesSent < maxFramesPerBatch) {
            val frame = frameBuffer.getFrame() ?: break
            onFrameEncoded(frame.buffer, frame.isKeyFrame, frame.codecType)
            framesSent++
        }
    }

    /**
     * Stop H.264 encoding and clean up resources.
     */
    private fun stopH264Encoding() {
        // Stop drain runnable
        drainRunnable?.let { encoderHandler?.removeCallbacks(it) }
        drainRunnable = null

        // Stop encoder
        videoEncoder?.stop()
        videoEncoder = null

        // Stop encoder thread
        encoderThread?.quitSafely()
        try {
            encoderThread?.join(5000) // 5 second timeout
        } catch (e: InterruptedException) {
            Log.w(TAG, "Interrupted while waiting for encoder thread to stop", e)
        }
        encoderThread = null
        encoderHandler = null
    }

    /**
     * Stop MJPEG encoding and clean up resources.
     */
    private fun stopMjpegEncoding() {
        mjpegEncoder?.stop()
        mjpegEncoder = null
    }

    /**
     * Pause screen capture without releasing MediaProjection.
     * This allows the MediaProjection permission to be reused for subsequent sessions.
     * Call stop() to fully release all resources including MediaProjection.
     */
    fun pauseCapture() {
        if (!isCapturing) return
        
        isCapturing = false
        
        try {
            // Clear frame buffer
            frameBuffer.clear()
            
            // Release virtual display
            virtualDisplay?.release()
            virtualDisplay = null

            // Stop encoders
            if (useH264) {
                stopH264Encoding()
            } else {
                stopMjpegEncoding()
            }

            // NOTE: Do NOT stop mediaProjection here - keep it alive for reuse
            Log.i(TAG, "Screen capture paused (MediaProjection kept alive for reuse)")
        } catch (e: Exception) {
            Log.e(TAG, "Error pausing screen capture", e)
        }
    }

    /**
     * Stop screen capture and release all resources including MediaProjection.
     * After calling this, a new MediaProjection permission must be granted.
     */
    fun stop() {
        if (!isCapturing && mediaProjection == null) return
        
        isCapturing = false
        
        try {
            // Clear frame buffer
            frameBuffer.clear()
            
            // Release virtual display
            virtualDisplay?.release()
            virtualDisplay = null

            // Stop encoders
            if (useH264) {
                stopH264Encoding()
            } else {
                stopMjpegEncoding()
            }

            // Stop media projection - this invalidates the permission
            mediaProjection?.stop()
            mediaProjection = null

            Log.i(TAG, "Screen capture stopped and MediaProjection released")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping screen capture", e)
        }
    }

    /**
     * Check if screen capture is active.
     */
    fun isCapturing(): Boolean = isCapturing

    /**
     * Get current encoder type.
     */
    fun getEncoderType(): String = if (useH264) "H.264" else "MJPEG"

    /**
     * Get encoder information for debugging/monitoring.
     */
    fun getEncoderInfo(): Map<String, Any> {
        val encoderInfo = if (useH264) {
            videoEncoder?.getEncoderInfo() ?: emptyMap()
        } else {
            mjpegEncoder?.getEncoderInfo() ?: emptyMap()
        }
        
        val bufferStats = frameBuffer.getStats()
        
        return encoderInfo + mapOf(
            "isCapturing" to isCapturing,
            "activeEncoder" to getEncoderType(),
            "buffer_size" to (bufferStats["size"] ?: 0),
            "buffer_capacity" to (bufferStats["capacity"] ?: 0),
            "buffer_utilization" to (bufferStats["utilization_percent"] ?: 0.0)
        )
    }

    /**
     * Get display metrics for the device.
     * Uses getRealMetrics to get the full physical screen dimensions,
     * including system bars (status bar, navigation bar).
     * This is important because screen capture captures the full screen.
     */
    private fun getDisplayMetrics(): DisplayMetrics {
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        // Use getRealMetrics to get full physical screen dimensions (including system bars)
        // This matches what MediaProjection captures
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getRealMetrics(metrics)
        return metrics
    }
}
