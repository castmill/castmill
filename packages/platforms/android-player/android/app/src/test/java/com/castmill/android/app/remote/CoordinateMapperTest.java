package com.castmill.android.app.remote;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.content.Context;
import android.graphics.Point;
import android.view.Display;
import android.view.Surface;
import android.view.WindowManager;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * Unit tests for CoordinateMapper class.
 * Tests coordinate mapping, letterboxing, and rotation handling.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class CoordinateMapperTest {

    @Mock
    private Context mockContext;

    @Mock
    private WindowManager mockWindowManager;

    @Mock
    private Display mockDisplay;

    private CoordinateMapper coordinateMapper;

    @Before
    public void setUp() {
        MockitoAnnotations.initMocks(this);

        // Setup mock context and window manager
        when(mockContext.getSystemService(Context.WINDOW_SERVICE)).thenReturn(mockWindowManager);
        when(mockWindowManager.getDefaultDisplay()).thenReturn(mockDisplay);

        coordinateMapper = new CoordinateMapper(mockContext);
    }

    /**
     * Test simple coordinate mapping with matching aspect ratios
     */
    @Test
    public void testMapToDevice_MatchingAspectRatio() {
        // Setup: Remote 800x600, Device 1600x1200 (both 4:3)
        coordinateMapper.setRemoteDimensions(800, 600);
        mockDeviceDimensions(1600, 1200);

        // Map center point
        Point result = coordinateMapper.mapToDevice(400, 300);

        // Should be exactly scaled by 2x
        assertEquals(800, result.x);
        assertEquals(600, result.y);
    }

    /**
     * Test coordinate mapping with letterboxing (wider remote)
     */
    @Test
    public void testMapToDevice_WiderRemote_Letterbox() {
        // Setup: Remote 1920x1080 (16:9), Device 1200x1200 (1:1)
        coordinateMapper.setRemoteDimensions(1920, 1080);
        mockDeviceDimensions(1200, 1200);

        // Map center point of remote
        Point result = coordinateMapper.mapToDevice(960, 540);

        // Should be centered with letterbox on top/bottom
        assertEquals(600, result.x); // Center horizontally
        // Y should be adjusted for letterbox
        assertTrue(result.y >= 500 && result.y <= 700); // Allow some tolerance
    }

    /**
     * Test coordinate mapping with letterboxing (taller remote)
     */
    @Test
    public void testMapToDevice_TallerRemote_Letterbox() {
        // Setup: Remote 1080x1920 (9:16), Device 1200x1200 (1:1)
        coordinateMapper.setRemoteDimensions(1080, 1920);
        mockDeviceDimensions(1200, 1200);

        // Map center point of remote
        Point result = coordinateMapper.mapToDevice(540, 960);

        // Should be centered with letterbox on left/right
        assertTrue(result.x >= 500 && result.x <= 700); // Allow some tolerance
        assertEquals(600, result.y); // Center vertically
    }

    /**
     * Test corner coordinates mapping
     */
    @Test
    public void testMapToDevice_Corners() {
        coordinateMapper.setRemoteDimensions(1000, 500);
        mockDeviceDimensions(2000, 1000);

        // Top-left corner
        Point topLeft = coordinateMapper.mapToDevice(0, 0);
        assertEquals(0, topLeft.x);
        assertEquals(0, topLeft.y);

        // Bottom-right corner
        Point bottomRight = coordinateMapper.mapToDevice(1000, 500);
        assertEquals(2000, bottomRight.x);
        assertEquals(1000, bottomRight.y);
    }

    /**
     * Test coordinate clamping to device bounds
     */
    @Test
    public void testMapToDevice_Clamping() {
        coordinateMapper.setRemoteDimensions(100, 100);
        mockDeviceDimensions(200, 200);

        // Test coordinates beyond remote bounds
        Point result = coordinateMapper.mapToDevice(150, 150);

        // Should be clamped to device bounds
        assertTrue(result.x <= 199);
        assertTrue(result.y <= 199);
    }

    /**
     * Test mapping without setting remote dimensions
     */
    @Test(expected = IllegalStateException.class)
    public void testMapToDevice_NoDimensionsSet() {
        mockDeviceDimensions(1920, 1080);
        coordinateMapper.mapToDevice(100, 100);
    }

    /**
     * Test multiple point mapping
     */
    @Test
    public void testMapToDevice_MultiplePoints() {
        coordinateMapper.setRemoteDimensions(800, 600);
        mockDeviceDimensions(1600, 1200);

        Point[] remotePoints = new Point[]{
                new Point(0, 0),
                new Point(400, 300),
                new Point(800, 600)
        };

        Point[] devicePoints = coordinateMapper.mapToDevice(remotePoints);

        assertEquals(3, devicePoints.length);
        assertEquals(0, devicePoints[0].x);
        assertEquals(0, devicePoints[0].y);
        assertEquals(800, devicePoints[1].x);
        assertEquals(600, devicePoints[1].y);
        assertEquals(1600, devicePoints[2].x);
        assertEquals(1200, devicePoints[2].y);
    }

    /**
     * Test letterbox offset calculation
     */
    @Test
    public void testGetLetterboxOffset_NoLetterbox() {
        coordinateMapper.setRemoteDimensions(1920, 1080);
        mockDeviceDimensions(1920, 1080);

        Point offset = coordinateMapper.getLetterboxOffset();

        assertEquals(0, offset.x);
        assertEquals(0, offset.y);
    }

    /**
     * Test letterbox offset with vertical bars
     */
    @Test
    public void testGetLetterboxOffset_VerticalBars() {
        coordinateMapper.setRemoteDimensions(1080, 1920);
        mockDeviceDimensions(1200, 1200);

        Point offset = coordinateMapper.getLetterboxOffset();

        assertTrue(offset.x > 0); // Should have horizontal offset
        assertEquals(0, offset.y); // No vertical offset
    }

    /**
     * Test letterbox offset with horizontal bars
     */
    @Test
    public void testGetLetterboxOffset_HorizontalBars() {
        coordinateMapper.setRemoteDimensions(1920, 1080);
        mockDeviceDimensions(1200, 1200);

        Point offset = coordinateMapper.getLetterboxOffset();

        assertEquals(0, offset.x); // No horizontal offset
        assertTrue(offset.y > 0); // Should have vertical offset
    }

    /**
     * Test scale factor calculation
     */
    @Test
    public void testGetScaleFactor() {
        coordinateMapper.setRemoteDimensions(800, 600);
        mockDeviceDimensions(1600, 1200);

        Point scaleFactor = coordinateMapper.getScaleFactor();

        // Scale factors are multiplied by 1000 for precision
        assertEquals(2000, scaleFactor.x); // 2.0 scale
        assertEquals(2000, scaleFactor.y); // 2.0 scale
    }

    /**
     * Test scale factor with non-uniform scaling
     */
    @Test
    public void testGetScaleFactor_NonUniform() {
        coordinateMapper.setRemoteDimensions(1920, 1080);
        mockDeviceDimensions(1200, 1200);

        Point scaleFactor = coordinateMapper.getScaleFactor();

        // Both should be the same due to letterboxing
        assertEquals(scaleFactor.x, scaleFactor.y);
    }

    /**
     * Test device dimensions retrieval
     */
    @Test
    public void testGetDeviceDimensions() {
        mockDeviceDimensions(1920, 1080);

        Point dimensions = coordinateMapper.getDeviceDimensions();

        assertEquals(1920, dimensions.x);
        assertEquals(1080, dimensions.y);
    }

    /**
     * Test display rotation retrieval
     */
    @Test
    public void testGetDisplayRotation() {
        when(mockDisplay.getRotation()).thenReturn(Surface.ROTATION_90);

        int rotation = coordinateMapper.getDisplayRotation();

        assertEquals(Surface.ROTATION_90, rotation);
    }

    /**
     * Test rotation changes
     */
    @Test
    public void testGetDisplayRotation_AllOrientations() {
        // Test all rotation values
        int[] rotations = {Surface.ROTATION_0, Surface.ROTATION_90, Surface.ROTATION_180, Surface.ROTATION_270};

        for (int expectedRotation : rotations) {
            when(mockDisplay.getRotation()).thenReturn(expectedRotation);
            int actualRotation = coordinateMapper.getDisplayRotation();
            assertEquals(expectedRotation, actualRotation);
        }
    }

    /**
     * Test precision with fractional coordinates
     */
    @Test
    public void testMapToDevice_FractionalCoordinates() {
        coordinateMapper.setRemoteDimensions(1000, 1000);
        mockDeviceDimensions(2000, 2000);

        // Test fractional coordinates
        Point result = coordinateMapper.mapToDevice(123.456f, 789.012f);

        // Should round properly
        assertTrue(result.x >= 246 && result.x <= 248);
        assertTrue(result.y >= 1578 && result.y <= 1580);
    }

    /**
     * Test edge case: very small remote dimensions
     */
    @Test
    public void testMapToDevice_SmallRemote() {
        coordinateMapper.setRemoteDimensions(10, 10);
        mockDeviceDimensions(1000, 1000);

        Point result = coordinateMapper.mapToDevice(5, 5);

        // Should scale up significantly
        assertEquals(500, result.x);
        assertEquals(500, result.y);
    }

    /**
     * Test edge case: very large device dimensions
     */
    @Test
    public void testMapToDevice_LargeDevice() {
        coordinateMapper.setRemoteDimensions(1920, 1080);
        mockDeviceDimensions(3840, 2160);

        Point result = coordinateMapper.mapToDevice(960, 540);

        // Should scale by 2x
        assertEquals(1920, result.x);
        assertEquals(1080, result.y);
    }

    /**
     * Helper method to mock device dimensions
     */
    private void mockDeviceDimensions(int width, int height) {
        doAnswer(invocation -> {
            Point size = invocation.getArgument(0);
            size.x = width;
            size.y = height;
            return null;
        }).when(mockDisplay).getRealSize(any(Point.class));
    }
}
