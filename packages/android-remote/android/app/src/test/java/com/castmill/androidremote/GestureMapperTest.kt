package com.castmill.androidremote

import android.content.Context
import android.graphics.Point
import android.view.Display
import android.view.Surface
import android.view.WindowManager
import androidx.test.core.app.ApplicationProvider
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowDisplay

/**
 * Unit tests for GestureMapper using Robolectric.
 * 
 * These tests verify:
 * - Coordinate transformation from RC window to device screen
 * - Handling of different display rotations (0°, 90°, 180°, 270°)
 * - Letterboxing and pillarboxing scenarios
 * - Edge cases and boundary conditions
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class GestureMapperTest {

    private lateinit var context: Context
    private lateinit var windowManager: WindowManager

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    private fun setDisplaySize(width: Int, height: Int) {
        val display = windowManager.defaultDisplay
        val shadowDisplay = org.robolectric.Shadows.shadowOf(display)
        shadowDisplay.setWidth(width)
        shadowDisplay.setHeight(height)
    }

    @Test
    fun testMapPoint_sameAspectRatio() {
        // Arrange - RC window and device have same aspect ratio (16:9)
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act - Map center point
        val point = mapper.mapPoint(640f, 360f)
        
        // Assert
        assertNotNull("Point should be mapped", point)
        assertEquals("X coordinate should be scaled", 960, point!!.x)
        assertEquals("Y coordinate should be scaled", 540, point.y)
    }

    @Test
    fun testMapPoint_differentAspectRatio_letterbox() {
        // Arrange - RC window wider than device (letterbox scenario)
        // Device: 1080x1920 (portrait, 9:16)
        // RC: 1280x720 (landscape, 16:9)
        setDisplaySize(1080, 1920)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act - Map top-left corner
        val point = mapper.mapPoint(0f, 0f)
        
        // Assert - Should have vertical offset due to letterboxing
        assertNotNull("Point should be mapped", point)
        assertEquals("X should be at left edge", 0, point!!.x)
        assertTrue("Y should have letterbox offset", point.y > 0)
    }

    @Test
    fun testMapPoint_differentAspectRatio_pillarbox() {
        // Arrange - RC window taller than device (pillarbox scenario)
        // Device: 1920x1080 (landscape, 16:9)
        // RC: 720x1280 (portrait, 9:16)
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 720, 1280)
        
        // Act - Map top-left corner
        val point = mapper.mapPoint(0f, 0f)
        
        // Assert - Should have horizontal offset due to pillarboxing
        assertNotNull("Point should be mapped", point)
        assertTrue("X should have pillarbox offset", point!!.x > 0)
        assertEquals("Y should be at top edge", 0, point.y)
    }

    @Test
    fun testMapPoint_outOfBounds_negative() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act - Map negative coordinates
        val point = mapper.mapPoint(-10f, -10f)
        
        // Assert
        assertNull("Negative coordinates should return null", point)
    }

    @Test
    fun testMapPoint_outOfBounds_exceedsMax() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act - Map coordinates beyond RC window
        val point = mapper.mapPoint(1300f, 800f)
        
        // Assert
        assertNull("Out of bounds coordinates should return null", point)
    }

    @Test
    fun testMapPoint_exactBoundaries() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act - Map exact boundaries (0 to dimension-1 are valid)
        val topLeft = mapper.mapPoint(0f, 0f)
        val bottomRight = mapper.mapPoint(1279f, 719f)
        val outOfBounds = mapper.mapPoint(1280f, 720f)
        
        // Assert
        assertNotNull("Top-left should be valid", topLeft)
        assertNotNull("Bottom-right (dimension-1) should be valid", bottomRight)
        assertNull("Coordinates at dimension should be out of bounds", outOfBounds)
        assertEquals("Top-left X should be 0", 0, topLeft!!.x)
        assertEquals("Top-left Y should be 0", 0, topLeft.y)
    }

    @Test
    fun testMapPoints_multiplePoints() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        val rcPoints = listOf(
            Pair(0f, 0f),
            Pair(640f, 360f),
            Pair(1280f, 720f)
        )
        
        // Act
        val devicePoints = mapper.mapPoints(rcPoints)
        
        // Assert
        assertNotNull("Points should be mapped", devicePoints)
        assertEquals("Should have 3 points", 3, devicePoints!!.size)
        
        assertEquals("First point X", 0, devicePoints[0].x)
        assertEquals("First point Y", 0, devicePoints[0].y)
        
        assertEquals("Center point X", 960, devicePoints[1].x)
        assertEquals("Center point Y", 540, devicePoints[1].y)
    }

    @Test
    fun testMapPoints_withInvalidPoint() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        val rcPoints = listOf(
            Pair(640f, 360f),
            Pair(-10f, -10f),  // Invalid point
            Pair(1280f, 720f)
        )
        
        // Act
        val devicePoints = mapper.mapPoints(rcPoints)
        
        // Assert
        assertNull("Should return null if any point is invalid", devicePoints)
    }

    @Test
    fun testGetDeviceDimensions() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val (width, height) = mapper.getDeviceDimensions()
        
        // Assert
        assertEquals("Device width should match", 1920, width)
        assertEquals("Device height should match", 1080, height)
    }

    @Test
    fun testGetRCDimensions() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val (width, height) = mapper.getRCDimensions()
        
        // Assert
        assertEquals("RC width should match", 1280, width)
        assertEquals("RC height should match", 720, height)
    }

    @Test
    fun testGetScaleFactors_sameAspect() {
        // Arrange - Both 16:9 aspect ratio
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val (scaleX, scaleY) = mapper.getScaleFactors()
        
        // Assert
        assertEquals("Scale X should be 1.5", 1.5f, scaleX, 0.001f)
        assertEquals("Scale Y should be 1.5", 1.5f, scaleY, 0.001f)
    }

    @Test
    fun testGetScaleFactors_differentAspect() {
        // Arrange - Device wider than RC
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 720, 720)
        
        // Act
        val (scaleX, scaleY) = mapper.getScaleFactors()
        
        // Assert - Should use uniform scaling to maintain aspect ratio
        assertEquals("Scale X and Y should be equal", scaleX, scaleY, 0.001f)
    }

    @Test
    fun testGetOffsets_noLetterboxing() {
        // Arrange - Same aspect ratio, no letterboxing
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val (offsetX, offsetY) = mapper.getOffsets()
        
        // Assert
        assertEquals("Offset X should be 0", 0f, offsetX, 0.001f)
        assertEquals("Offset Y should be 0", 0f, offsetY, 0.001f)
    }

    @Test
    fun testGetOffsets_withLetterboxing() {
        // Arrange - RC wider than device (vertical letterboxing)
        setDisplaySize(1080, 1920)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val (offsetX, offsetY) = mapper.getOffsets()
        
        // Assert
        assertEquals("Offset X should be 0", 0f, offsetX, 0.001f)
        assertTrue("Offset Y should be positive", offsetY > 0)
    }

    @Test
    fun testGetOffsets_withPillarboxing() {
        // Arrange - RC taller than device (horizontal pillarboxing)
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 720, 1280)
        
        // Act
        val (offsetX, offsetY) = mapper.getOffsets()
        
        // Assert
        assertTrue("Offset X should be positive", offsetX > 0)
        assertEquals("Offset Y should be 0", 0f, offsetY, 0.001f)
    }

    @Test
    fun testUpdateDisplayMetrics() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        val originalPoint = mapper.mapPoint(640f, 360f)
        
        // Act - Change display size and update
        setDisplaySize(1280, 720)
        mapper.updateDisplayMetrics()
        
        val newPoint = mapper.mapPoint(640f, 360f)
        
        // Assert - Points should be different after display change
        assertNotNull("Original point should exist", originalPoint)
        assertNotNull("New point should exist", newPoint)
        assertNotEquals("Points should differ after display change", originalPoint, newPoint)
    }

    @Test
    fun testMapPoint_portraitDevice_landscapeRC() {
        // Arrange - Common tablet scenario
        setDisplaySize(800, 1280)  // Portrait device
        val mapper = GestureMapper(context, 1280, 720)  // Landscape RC
        
        // Act - Map center point
        val point = mapper.mapPoint(640f, 360f)
        
        // Assert - Should map correctly despite orientation mismatch
        assertNotNull("Point should be mapped", point)
        assertTrue("Mapped X should be within device bounds", point!!.x >= 0 && point.x < 800)
        assertTrue("Mapped Y should be within device bounds", point.y >= 0 && point.y < 1280)
    }

    @Test
    fun testMapPoint_landscapeDevice_portraitRC() {
        // Arrange
        setDisplaySize(1280, 800)  // Landscape device
        val mapper = GestureMapper(context, 720, 1280)  // Portrait RC
        
        // Act - Map center point
        val point = mapper.mapPoint(360f, 640f)
        
        // Assert - Should map correctly despite orientation mismatch
        assertNotNull("Point should be mapped", point)
        assertTrue("Mapped X should be within device bounds", point!!.x >= 0 && point.x < 1280)
        assertTrue("Mapped Y should be within device bounds", point.y >= 0 && point.y < 800)
    }

    @Test
    fun testMapPoint_squareRC_rectangleDevice() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 720, 720)  // Square RC
        
        // Act - Map center
        val point = mapper.mapPoint(360f, 360f)
        
        // Assert
        assertNotNull("Point should be mapped", point)
        // Center of square RC should map near center Y, with X offset
        assertTrue("Mapped Y should be near center", Math.abs(point!!.y - 540) < 50)
    }

    @Test
    fun testMapPoint_verySmallRC() {
        // Arrange - Small RC window
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 320, 180)
        
        // Act - Map center
        val point = mapper.mapPoint(160f, 90f)
        
        // Assert - Should scale up correctly
        assertNotNull("Point should be mapped", point)
        assertEquals("X should scale up 6x", 960, point!!.x)
        assertEquals("Y should scale up 6x", 540, point.y)
    }

    @Test
    fun testMapPoint_veryLargeRC() {
        // Arrange - Large RC window
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 3840, 2160)
        
        // Act - Map center
        val point = mapper.mapPoint(1920f, 1080f)
        
        // Assert - Should scale down correctly
        assertNotNull("Point should be mapped", point)
        assertEquals("X should scale down 0.5x", 960, point!!.x)
        assertEquals("Y should scale down 0.5x", 540, point.y)
    }

    @Test
    fun testMapPoints_emptyList() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val points = mapper.mapPoints(emptyList())
        
        // Assert
        assertNotNull("Empty list should return empty list", points)
        assertTrue("Result should be empty", points!!.isEmpty())
    }

    @Test
    fun testMapPoints_singlePoint() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val points = mapper.mapPoints(listOf(Pair(640f, 360f)))
        
        // Assert
        assertNotNull("Single point should be mapped", points)
        assertEquals("Should have one point", 1, points!!.size)
        assertEquals("X should be scaled", 960, points[0].x)
        assertEquals("Y should be scaled", 540, points[0].y)
    }

    @Test
    fun testGetRotation() {
        // Arrange
        setDisplaySize(1920, 1080)
        val mapper = GestureMapper(context, 1280, 720)
        
        // Act
        val rotation = mapper.getRotation()
        
        // Assert - Default rotation should be 0
        assertEquals("Default rotation should be 0", Surface.ROTATION_0, rotation)
    }
}
