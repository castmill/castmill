package com.castmill.android.app.remote;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.graphics.Point;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.MockitoAnnotations;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * Unit tests for RemoteInputPlugin.
 * Tests plugin methods and integration with accessibility service.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE)
public class RemoteInputPluginTest {

    @Mock
    private PluginCall mockCall;

    @Mock
    private RemoteInputAccessibilityService mockService;

    @Mock
    private CoordinateMapper mockMapper;

    private RemoteInputPlugin plugin;

    @Before
    public void setUp() {
        MockitoAnnotations.initMocks(this);
        plugin = new RemoteInputPlugin();

        // Setup mock service and mapper
        when(mockService.getCoordinateMapper()).thenReturn(mockMapper);
    }

    /**
     * Test setRemoteDimensions with valid parameters
     */
    @Test
    public void testSetRemoteDimensions_Success() {
        when(mockCall.getInt("width")).thenReturn(1920);
        when(mockCall.getInt("height")).thenReturn(1080);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            plugin.setRemoteDimensions(mockCall);

            verify(mockMapper).setRemoteDimensions(1920, 1080);
            verify(mockCall).resolve(any(JSObject.class));
            verify(mockCall, never()).reject(anyString());
        }
    }

    /**
     * Test setRemoteDimensions with missing width
     */
    @Test
    public void testSetRemoteDimensions_MissingWidth() {
        when(mockCall.getInt("width")).thenReturn(null);
        when(mockCall.getInt("height")).thenReturn(1080);

        plugin.setRemoteDimensions(mockCall);

        verify(mockCall).reject("Width and height are required");
        verify(mockCall, never()).resolve(any());
    }

    /**
     * Test setRemoteDimensions with service not running
     */
    @Test
    public void testSetRemoteDimensions_ServiceNotRunning() {
        when(mockCall.getInt("width")).thenReturn(1920);
        when(mockCall.getInt("height")).thenReturn(1080);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(null);

            plugin.setRemoteDimensions(mockCall);

            verify(mockCall).reject("Accessibility service not running");
        }
    }

    /**
     * Test getDeviceDimensions
     */
    @Test
    public void testGetDeviceDimensions_Success() {
        when(mockMapper.getDeviceDimensions()).thenReturn(new Point(1920, 1080));

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            plugin.getDeviceDimensions(mockCall);

            ArgumentCaptor<JSObject> captor = ArgumentCaptor.forClass(JSObject.class);
            verify(mockCall).resolve(captor.capture());
            
            JSObject result = captor.getValue();
            assertEquals(1920, result.getInteger("width").intValue());
            assertEquals(1080, result.getInteger("height").intValue());
        }
    }

    /**
     * Test getDisplayRotation
     */
    @Test
    public void testGetDisplayRotation_Success() {
        when(mockMapper.getDisplayRotation()).thenReturn(1);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            plugin.getDisplayRotation(mockCall);

            ArgumentCaptor<JSObject> captor = ArgumentCaptor.forClass(JSObject.class);
            verify(mockCall).resolve(captor.capture());
            
            JSObject result = captor.getValue();
            assertEquals(1, result.getInteger("rotation").intValue());
        }
    }

    /**
     * Test executeTap with valid coordinates
     */
    @Test
    public void testExecuteTap_Success() {
        when(mockCall.getDouble("x")).thenReturn(100.0);
        when(mockCall.getDouble("y")).thenReturn(200.0);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            // Mock executeTap to immediately call onCompleted
            doAnswer(invocation -> {
                RemoteInputAccessibilityService.GestureResultCallback callback = invocation.getArgument(2);
                callback.onCompleted();
                return null;
            }).when(mockService).executeTap(anyFloat(), anyFloat(), any());

            plugin.executeTap(mockCall);

            verify(mockService).executeTap(eq(100.0f), eq(200.0f), any());
            verify(mockCall).resolve();
        }
    }

    /**
     * Test executeTap with missing coordinates
     */
    @Test
    public void testExecuteTap_MissingCoordinates() {
        when(mockCall.getDouble("x")).thenReturn(null);
        when(mockCall.getDouble("y")).thenReturn(200.0);

        plugin.executeTap(mockCall);

        verify(mockCall).reject("X and Y coordinates are required");
    }

    /**
     * Test executeTap gesture cancelled
     */
    @Test
    public void testExecuteTap_Cancelled() {
        when(mockCall.getDouble("x")).thenReturn(100.0);
        when(mockCall.getDouble("y")).thenReturn(200.0);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            doAnswer(invocation -> {
                RemoteInputAccessibilityService.GestureResultCallback callback = invocation.getArgument(2);
                callback.onCancelled();
                return null;
            }).when(mockService).executeTap(anyFloat(), anyFloat(), any());

            plugin.executeTap(mockCall);

            verify(mockCall).reject("Gesture cancelled");
            verify(mockCall, never()).resolve();
        }
    }

    /**
     * Test executeLongPress
     */
    @Test
    public void testExecuteLongPress_Success() {
        when(mockCall.getDouble("x")).thenReturn(150.0);
        when(mockCall.getDouble("y")).thenReturn(250.0);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            doAnswer(invocation -> {
                RemoteInputAccessibilityService.GestureResultCallback callback = invocation.getArgument(2);
                callback.onCompleted();
                return null;
            }).when(mockService).executeLongPress(anyFloat(), anyFloat(), any());

            plugin.executeLongPress(mockCall);

            verify(mockService).executeLongPress(eq(150.0f), eq(250.0f), any());
            verify(mockCall).resolve();
        }
    }

    /**
     * Test executeSwipe with valid parameters
     */
    @Test
    public void testExecuteSwipe_Success() {
        when(mockCall.getDouble("x1")).thenReturn(100.0);
        when(mockCall.getDouble("y1")).thenReturn(100.0);
        when(mockCall.getDouble("x2")).thenReturn(200.0);
        when(mockCall.getDouble("y2")).thenReturn(200.0);
        when(mockCall.getInt("duration", 300)).thenReturn(300);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            doAnswer(invocation -> {
                RemoteInputAccessibilityService.GestureResultCallback callback = invocation.getArgument(5);
                callback.onCompleted();
                return null;
            }).when(mockService).executeSwipe(anyFloat(), anyFloat(), anyFloat(), anyFloat(), anyLong(), any());

            plugin.executeSwipe(mockCall);

            verify(mockService).executeSwipe(eq(100.0f), eq(100.0f), eq(200.0f), eq(200.0f), eq(300L), any());
            verify(mockCall).resolve();
        }
    }

    /**
     * Test executeSwipe with missing coordinates
     */
    @Test
    public void testExecuteSwipe_MissingCoordinates() {
        when(mockCall.getDouble("x1")).thenReturn(null);

        plugin.executeSwipe(mockCall);

        verify(mockCall).reject("Start and end coordinates are required");
    }

    /**
     * Test executeMultiStepGesture with valid points
     */
    @Test
    public void testExecuteMultiStepGesture_Success() throws Exception {
        JSONArray pointsJson = new JSONArray();
        pointsJson.put(new JSONObject().put("x", 100).put("y", 100));
        pointsJson.put(new JSONObject().put("x", 200).put("y", 200));
        pointsJson.put(new JSONObject().put("x", 300).put("y", 300));

        JSArray pointsArray = JSArray.from(pointsJson);
        when(mockCall.getArray("points")).thenReturn(pointsArray);
        when(mockCall.getInt("duration", 500)).thenReturn(500);

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            doAnswer(invocation -> {
                RemoteInputAccessibilityService.GestureResultCallback callback = invocation.getArgument(2);
                callback.onCompleted();
                return null;
            }).when(mockService).executeMultiStepGesture(any(Point[].class), anyLong(), any());

            plugin.executeMultiStepGesture(mockCall);

            verify(mockService).executeMultiStepGesture(any(Point[].class), eq(500L), any());
            verify(mockCall).resolve();
        }
    }

    /**
     * Test executeMultiStepGesture with insufficient points
     */
    @Test
    public void testExecuteMultiStepGesture_InsufficientPoints() throws Exception {
        JSONArray pointsJson = new JSONArray();
        pointsJson.put(new JSONObject().put("x", 100).put("y", 100));

        JSArray pointsArray = JSArray.from(pointsJson);
        when(mockCall.getArray("points")).thenReturn(pointsArray);

        plugin.executeMultiStepGesture(mockCall);

        verify(mockCall).reject("At least 2 points are required");
    }

    /**
     * Test isServiceRunning when service is running
     */
    @Test
    public void testIsServiceRunning_True() {
        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            plugin.isServiceRunning(mockCall);

            ArgumentCaptor<JSObject> captor = ArgumentCaptor.forClass(JSObject.class);
            verify(mockCall).resolve(captor.capture());
            
            JSObject result = captor.getValue();
            assertTrue(result.getBoolean("isRunning"));
        }
    }

    /**
     * Test isServiceRunning when service is not running
     */
    @Test
    public void testIsServiceRunning_False() {
        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(null);

            plugin.isServiceRunning(mockCall);

            ArgumentCaptor<JSObject> captor = ArgumentCaptor.forClass(JSObject.class);
            verify(mockCall).resolve(captor.capture());
            
            JSObject result = captor.getValue();
            assertFalse(result.getBoolean("isRunning"));
        }
    }

    /**
     * Test getMappingInfo
     */
    @Test
    public void testGetMappingInfo_Success() {
        when(mockMapper.getDeviceDimensions()).thenReturn(new Point(1920, 1080));
        when(mockMapper.getLetterboxOffset()).thenReturn(new Point(0, 100));
        when(mockMapper.getScaleFactor()).thenReturn(new Point(1500, 1500));

        try (MockedStatic<RemoteInputAccessibilityService> mockedStatic = 
                mockStatic(RemoteInputAccessibilityService.class)) {
            mockedStatic.when(RemoteInputAccessibilityService::getInstance).thenReturn(mockService);

            plugin.getMappingInfo(mockCall);

            ArgumentCaptor<JSObject> captor = ArgumentCaptor.forClass(JSObject.class);
            verify(mockCall).resolve(captor.capture());
            
            JSObject result = captor.getValue();
            assertEquals(1920, result.getInteger("deviceWidth").intValue());
            assertEquals(1080, result.getInteger("deviceHeight").intValue());
            assertEquals(0, result.getInteger("offsetX").intValue());
            assertEquals(100, result.getInteger("offsetY").intValue());
            assertEquals(1.5, result.getDouble("scaleX"), 0.01);
            assertEquals(1.5, result.getDouble("scaleY"), 0.01);
        }
    }
}
