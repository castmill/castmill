package com.castmill.android.app.remote;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.accessibilityservice.GestureDescription;
import android.graphics.Point;
import android.os.Build;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * Unit tests for RemoteInputAccessibilityService.
 * Tests gesture execution and callback handling.
 */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = Build.VERSION_CODES.N)
public class RemoteInputAccessibilityServiceTest {

    @Mock
    private CoordinateMapper mockCoordinateMapper;

    @Mock
    private RemoteInputAccessibilityService.GestureResultCallback mockCallback;

    private RemoteInputAccessibilityService service;

    @Before
    public void setUp() {
        MockitoAnnotations.initMocks(this);

        // Create a spy of the service to mock dispatchGesture
        service = spy(new RemoteInputAccessibilityService());

        // Mock the coordinate mapper
        when(mockCoordinateMapper.mapToDevice(anyFloat(), anyFloat()))
                .thenReturn(new Point(100, 200));
        when(mockCoordinateMapper.mapToDevice(any(Point[].class)))
                .thenAnswer(invocation -> {
                    Point[] input = invocation.getArgument(0);
                    Point[] output = new Point[input.length];
                    for (int i = 0; i < input.length; i++) {
                        output[i] = new Point(input[i].x * 2, input[i].y * 2);
                    }
                    return output;
                });

        // Inject the mock coordinate mapper
        // Note: In real implementation, this would be done through dependency injection
        // For testing, we'll test the integration separately
    }

    /**
     * Test that service instance is properly tracked
     */
    @Test
    public void testGetInstance_BeforeOnCreate() {
        // Before onCreate is called
        assertNull(RemoteInputAccessibilityService.getInstance());
    }

    /**
     * Test coordinate mapper initialization
     */
    @Test
    public void testCoordinateMapper_NotNull() {
        service.onCreate();
        assertNotNull(service.getCoordinateMapper());
    }

    /**
     * Test tap gesture execution with callback
     */
    @Test
    public void testExecuteTapAtDevice_Success() {
        service.onCreate();

        // Mock dispatchGesture to immediately call onCompleted
        doAnswer(invocation -> {
            GestureDescription gesture = invocation.getArgument(0);
            android.accessibilityservice.AccessibilityService.GestureResultCallback callback = invocation.getArgument(1);
            
            // Verify gesture has strokes
            assertNotNull(gesture);
            
            // Simulate successful gesture
            if (callback != null) {
                callback.onCompleted(gesture);
            }
            return true;
        }).when(service).dispatchGesture(any(GestureDescription.class), any(), any());

        service.executeTapAtDevice(100, 200, mockCallback);

        verify(mockCallback).onCompleted();
        verify(mockCallback, never()).onCancelled();
    }

    /**
     * Test tap gesture cancellation
     */
    @Test
    public void testExecuteTapAtDevice_Cancelled() {
        service.onCreate();

        // Mock dispatchGesture to call onCancelled
        doAnswer(invocation -> {
            GestureDescription gesture = invocation.getArgument(0);
            android.accessibilityservice.AccessibilityService.GestureResultCallback callback = invocation.getArgument(1);
            
            if (callback != null) {
                callback.onCancelled(gesture);
            }
            return true;
        }).when(service).dispatchGesture(any(GestureDescription.class), any(), any());

        service.executeTapAtDevice(100, 200, mockCallback);

        verify(mockCallback).onCancelled();
        verify(mockCallback, never()).onCompleted();
    }

    /**
     * Test tap with null callback (should not crash)
     */
    @Test
    public void testExecuteTapAtDevice_NullCallback() {
        service.onCreate();

        // Mock dispatchGesture
        doAnswer(invocation -> {
            GestureDescription gesture = invocation.getArgument(0);
            android.accessibilityservice.AccessibilityService.GestureResultCallback callback = invocation.getArgument(1);
            
            if (callback != null) {
                callback.onCompleted(gesture);
            }
            return true;
        }).when(service).dispatchGesture(any(GestureDescription.class), any(), any());

        // Should not throw exception
        service.executeTapAtDevice(100, 200, null);
    }

    /**
     * Test long press gesture execution
     */
    @Test
    public void testExecuteLongPressAtDevice_Success() {
        service.onCreate();

        doAnswer(invocation -> {
            GestureDescription gesture = invocation.getArgument(0);
            android.accessibilityservice.AccessibilityService.GestureResultCallback callback = invocation.getArgument(1);
            
            if (callback != null) {
                callback.onCompleted(gesture);
            }
            return true;
        }).when(service).dispatchGesture(any(GestureDescription.class), any(), any());

        service.executeLongPressAtDevice(150, 250, mockCallback);

        verify(mockCallback).onCompleted();
    }

    /**
     * Test swipe gesture execution
     */
    @Test
    public void testExecuteSwipeAtDevice_Success() {
        service.onCreate();

        doAnswer(invocation -> {
            GestureDescription gesture = invocation.getArgument(0);
            android.accessibilityservice.AccessibilityService.GestureResultCallback callback = invocation.getArgument(1);
            
            if (callback != null) {
                callback.onCompleted(gesture);
            }
            return true;
        }).when(service).dispatchGesture(any(GestureDescription.class), any(), any());

        service.executeSwipeAtDevice(100, 100, 200, 200, 300, mockCallback);

        verify(mockCallback).onCompleted();
    }

    /**
     * Test multi-step gesture with valid points
     */
    @Test
    public void testExecuteMultiStepGestureAtDevice_Success() {
        service.onCreate();

        doAnswer(invocation -> {
            GestureDescription gesture = invocation.getArgument(0);
            android.accessibilityservice.AccessibilityService.GestureResultCallback callback = invocation.getArgument(1);
            
            if (callback != null) {
                callback.onCompleted(gesture);
            }
            return true;
        }).when(service).dispatchGesture(any(GestureDescription.class), any(), any());

        Point[] points = new Point[]{
                new Point(100, 100),
                new Point(150, 150),
                new Point(200, 200)
        };

        service.executeMultiStepGestureAtDevice(points, 500, mockCallback);

        verify(mockCallback).onCompleted();
    }

    /**
     * Test multi-step gesture with insufficient points
     */
    @Test
    public void testExecuteMultiStepGestureAtDevice_InsufficientPoints() {
        service.onCreate();

        Point[] points = new Point[]{new Point(100, 100)};

        service.executeMultiStepGestureAtDevice(points, 500, mockCallback);

        verify(mockCallback).onCancelled();
        verify(mockCallback, never()).onCompleted();
    }

    /**
     * Test multi-step gesture with null points
     */
    @Test
    public void testExecuteMultiStepGestureAtDevice_NullPoints() {
        service.onCreate();

        service.executeMultiStepGestureAtDevice(null, 500, mockCallback);

        verify(mockCallback).onCancelled();
        verify(mockCallback, never()).onCompleted();
    }

    /**
     * Test multi-step gesture with empty array
     */
    @Test
    public void testExecuteMultiStepGestureAtDevice_EmptyArray() {
        service.onCreate();

        Point[] points = new Point[0];

        service.executeMultiStepGestureAtDevice(points, 500, mockCallback);

        verify(mockCallback).onCancelled();
    }

    /**
     * Test onDestroy clears instance
     */
    @Test
    public void testOnDestroy_ClearsInstance() {
        service.onCreate();
        assertNotNull(RemoteInputAccessibilityService.getInstance());

        service.onDestroy();
        assertNull(RemoteInputAccessibilityService.getInstance());
    }

    /**
     * Test onAccessibilityEvent doesn't crash
     */
    @Test
    public void testOnAccessibilityEvent_DoesNotCrash() {
        service.onCreate();
        // Should not throw exception
        service.onAccessibilityEvent(null);
    }

    /**
     * Test onInterrupt doesn't crash
     */
    @Test
    public void testOnInterrupt_DoesNotCrash() {
        service.onCreate();
        // Should not throw exception
        service.onInterrupt();
    }
}
