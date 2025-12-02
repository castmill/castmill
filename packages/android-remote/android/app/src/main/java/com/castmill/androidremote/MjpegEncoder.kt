package com.castmill.androidremote

import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

/**
 * MjpegEncoder provides a fallback encoding mechanism using JPEG frames.
 * 
 * This encoder is used when H.264/AVC encoding fails or is unavailable.
 * It captures frames at a lower rate and encodes them as JPEG images.
 * 
 * Specifications:
 * - Format: Motion JPEG (series of JPEG frames)
 * - Resolution: Configurable (default: 720p)
 * - Frame rate: Lower than H.264 (default: 5 fps)
 * - Quality: Configurable JPEG quality (default: 75)
 * 
 * @param width Frame width (default: 1280)
 * @param height Frame height (default: 720)
 * @param frameRate Target frame rate (default: 5)
 * @param quality JPEG quality 0-100 (default: 75)
 * @param onEncodedFrame Callback when a JPEG frame is encoded
 * @param onError Callback when an error occurs
 */
class MjpegEncoder(
    private val width: Int = 1280,
    private val height: Int = 720,
    private val frameRate: Int = 5,
    private val quality: Int = 75,
    private val onEncodedFrame: (ByteBuffer, Long, Boolean) -> Unit,
    private val onError: (Exception) -> Unit
) {
    companion object {
        private const val TAG = "MjpegEncoder"
        private const val MAX_IMAGES = 2
    }

    private var imageReader: ImageReader? = null
    private var encoderThread: HandlerThread? = null
    private var encoderHandler: Handler? = null
    private var isEncoding = false
    private var frameCount = 0L

    /**
     * Initialize the MJPEG encoder.
     * @return true if initialization was successful, false otherwise
     */
    fun start(): Boolean {
        try {
            // Create encoder thread
            encoderThread = HandlerThread("MjpegEncoderThread").apply {
                start()
            }
            encoderHandler = Handler(encoderThread!!.looper)

            // Create ImageReader for capturing frames
            imageReader = ImageReader.newInstance(
                width,
                height,
                PixelFormat.RGBA_8888,
                MAX_IMAGES
            ).apply {
                setOnImageAvailableListener({ reader ->
                    processImage(reader)
                }, encoderHandler)
            }

            isEncoding = true
            Log.i(TAG, "MjpegEncoder initialized: ${width}x${height} @ ${frameRate}fps, quality=$quality")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MjpegEncoder", e)
            onError(e)
            return false
        }
    }

    /**
     * Get the ImageReader surface for rendering frames to encode.
     * This surface should be used as the target for MediaProjection's VirtualDisplay.
     */
    fun getSurface() = imageReader?.surface

    /**
     * Process an image from the ImageReader and encode it as JPEG.
     */
    private fun processImage(reader: ImageReader) {
        var image: Image? = null
        try {
            image = reader.acquireLatestImage()
            if (image != null) {
                encodeImageAsJpeg(image)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing image", e)
            onError(e)
        } finally {
            image?.close()
        }
    }

    /**
     * Encode an Image as JPEG.
     */
    private fun encodeImageAsJpeg(image: Image) {
        try {
            val planes = image.planes
            val imageBuffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * width

            // Create bitmap from image buffer
            val bitmap = Bitmap.createBitmap(
                width + rowPadding / pixelStride,
                height,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(imageBuffer)

            // Crop if there's row padding
            val croppedBitmap = if (rowPadding > 0) {
                Bitmap.createBitmap(bitmap, 0, 0, width, height)
            } else {
                bitmap
            }

            // Encode as JPEG
            val outputStream = ByteArrayOutputStream()
            croppedBitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
            val jpegData = outputStream.toByteArray()

            // Create ByteBuffer and send to callback
            val jpegBuffer = ByteBuffer.wrap(jpegData)
            val timestamp = System.nanoTime() / 1000 // Convert to microseconds
            
            // Every frame is a "keyframe" in MJPEG
            onEncodedFrame(jpegBuffer, timestamp, true)
            
            frameCount++

            // Clean up bitmaps
            if (croppedBitmap != bitmap) {
                croppedBitmap.recycle()
            }
            bitmap.recycle()
        } catch (e: Exception) {
            Log.e(TAG, "Error encoding JPEG", e)
            onError(e)
        }
    }

    /**
     * Stop the encoder and release resources.
     */
    fun stop() {
        isEncoding = false

        try {
            imageReader?.close()
            imageReader = null

            encoderThread?.quitSafely()
            try {
                encoderThread?.join(5000) // 5 second timeout
            } catch (e: InterruptedException) {
                Log.w(TAG, "Interrupted while waiting for encoder thread to stop", e)
            }
            encoderThread = null
            encoderHandler = null

            Log.i(TAG, "MjpegEncoder stopped. Total frames encoded: $frameCount")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping MjpegEncoder", e)
        }
    }

    /**
     * Check if the encoder is currently encoding.
     */
    fun isEncoding(): Boolean = isEncoding

    /**
     * Get encoder information for debugging/monitoring.
     */
    fun getEncoderInfo(): Map<String, Any> {
        return mapOf(
            "codec" to "MJPEG",
            "width" to width,
            "height" to height,
            "frameRate" to frameRate,
            "quality" to quality,
            "frameCount" to frameCount,
            "isEncoding" to isEncoding
        )
    }
}
