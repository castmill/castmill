package com.castmill.android.app.remote;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Point;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import androidx.annotation.RequiresApi;

/**
 * Accessibility service for executing remote control gestures.
 * Handles tap, long press, swipe, and multi-step gestures using GestureDescription API.
 */
@RequiresApi(api = Build.VERSION_CODES.N)
public class RemoteInputAccessibilityService extends AccessibilityService {
    private static final String TAG = "RemoteInputService";
    private static RemoteInputAccessibilityService instance;
    private CoordinateMapper coordinateMapper;

    // Gesture timing constants
    private static final long TAP_DURATION_MS = 100;
    private static final long LONG_PRESS_DURATION_MS = 1000;
    private static final long SWIPE_DURATION_MS = 300;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        coordinateMapper = new CoordinateMapper(this);
        Log.d(TAG, "RemoteInputAccessibilityService created");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.d(TAG, "RemoteInputAccessibilityService destroyed");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // We don't need to handle accessibility events for gesture injection
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Service interrupted");
    }

    /**
     * Gets the singleton instance of the service.
     *
     * @return Service instance or null if not running
     */
    public static RemoteInputAccessibilityService getInstance() {
        return instance;
    }

    /**
     * Gets the coordinate mapper for this service.
     *
     * @return CoordinateMapper instance
     */
    public CoordinateMapper getCoordinateMapper() {
        return coordinateMapper;
    }

    /**
     * Executes a tap gesture at the specified coordinates.
     *
     * @param x X coordinate in remote window
     * @param y Y coordinate in remote window
     * @param callback Callback for gesture result
     */
    public void executeTap(float x, float y, GestureResultCallback callback) {
        Point devicePoint = coordinateMapper.mapToDevice(x, y);
        executeTapAtDevice(devicePoint.x, devicePoint.y, callback);
    }

    /**
     * Executes a tap gesture at device coordinates.
     *
     * @param x X coordinate on device screen
     * @param y Y coordinate on device screen
     * @param callback Callback for gesture result
     */
    public void executeTapAtDevice(int x, int y, GestureResultCallback callback) {
        Path path = new Path();
        path.moveTo(x, y);

        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(
                path, 0, TAP_DURATION_MS);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), new AccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.d(TAG, "Tap completed at (" + x + ", " + y + ")");
                if (callback != null) {
                    callback.onCompleted();
                }
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "Tap cancelled at (" + x + ", " + y + ")");
                if (callback != null) {
                    callback.onCancelled();
                }
            }
        }, null);
    }

    /**
     * Executes a long press gesture at the specified coordinates.
     *
     * @param x X coordinate in remote window
     * @param y Y coordinate in remote window
     * @param callback Callback for gesture result
     */
    public void executeLongPress(float x, float y, GestureResultCallback callback) {
        Point devicePoint = coordinateMapper.mapToDevice(x, y);
        executeLongPressAtDevice(devicePoint.x, devicePoint.y, callback);
    }

    /**
     * Executes a long press gesture at device coordinates.
     *
     * @param x X coordinate on device screen
     * @param y Y coordinate on device screen
     * @param callback Callback for gesture result
     */
    public void executeLongPressAtDevice(int x, int y, GestureResultCallback callback) {
        Path path = new Path();
        path.moveTo(x, y);

        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(
                path, 0, LONG_PRESS_DURATION_MS);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), new AccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.d(TAG, "Long press completed at (" + x + ", " + y + ")");
                if (callback != null) {
                    callback.onCompleted();
                }
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "Long press cancelled at (" + x + ", " + y + ")");
                if (callback != null) {
                    callback.onCancelled();
                }
            }
        }, null);
    }

    /**
     * Executes a swipe gesture between two points.
     *
     * @param x1 Start X coordinate in remote window
     * @param y1 Start Y coordinate in remote window
     * @param x2 End X coordinate in remote window
     * @param y2 End Y coordinate in remote window
     * @param callback Callback for gesture result
     */
    public void executeSwipe(float x1, float y1, float x2, float y2, GestureResultCallback callback) {
        Point startPoint = coordinateMapper.mapToDevice(x1, y1);
        Point endPoint = coordinateMapper.mapToDevice(x2, y2);
        executeSwipeAtDevice(startPoint.x, startPoint.y, endPoint.x, endPoint.y, SWIPE_DURATION_MS, callback);
    }

    /**
     * Executes a swipe gesture with custom duration.
     *
     * @param x1 Start X coordinate in remote window
     * @param y1 Start Y coordinate in remote window
     * @param x2 End X coordinate in remote window
     * @param y2 End Y coordinate in remote window
     * @param durationMs Duration in milliseconds
     * @param callback Callback for gesture result
     */
    public void executeSwipe(float x1, float y1, float x2, float y2, long durationMs, GestureResultCallback callback) {
        Point startPoint = coordinateMapper.mapToDevice(x1, y1);
        Point endPoint = coordinateMapper.mapToDevice(x2, y2);
        executeSwipeAtDevice(startPoint.x, startPoint.y, endPoint.x, endPoint.y, durationMs, callback);
    }

    /**
     * Executes a swipe gesture at device coordinates.
     *
     * @param x1 Start X coordinate on device screen
     * @param y1 Start Y coordinate on device screen
     * @param x2 End X coordinate on device screen
     * @param y2 End Y coordinate on device screen
     * @param durationMs Duration in milliseconds
     * @param callback Callback for gesture result
     */
    public void executeSwipeAtDevice(int x1, int y1, int x2, int y2, long durationMs, GestureResultCallback callback) {
        Path path = new Path();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);

        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(
                path, 0, durationMs);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), new AccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.d(TAG, "Swipe completed from (" + x1 + ", " + y1 + ") to (" + x2 + ", " + y2 + ")");
                if (callback != null) {
                    callback.onCompleted();
                }
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "Swipe cancelled from (" + x1 + ", " + y1 + ") to (" + x2 + ", " + y2 + ")");
                if (callback != null) {
                    callback.onCancelled();
                }
            }
        }, null);
    }

    /**
     * Executes a multi-step gesture following a path of points.
     *
     * @param points Array of points in remote window coordinates
     * @param durationMs Total duration for the gesture in milliseconds
     * @param callback Callback for gesture result
     */
    public void executeMultiStepGesture(Point[] points, long durationMs, GestureResultCallback callback) {
        if (points == null || points.length < 2) {
            Log.e(TAG, "Multi-step gesture requires at least 2 points");
            if (callback != null) {
                callback.onCancelled();
            }
            return;
        }

        // Map all points to device coordinates
        Point[] devicePoints = coordinateMapper.mapToDevice(points);
        executeMultiStepGestureAtDevice(devicePoints, durationMs, callback);
    }

    /**
     * Executes a multi-step gesture at device coordinates.
     *
     * @param points Array of points in device coordinates
     * @param durationMs Total duration for the gesture in milliseconds
     * @param callback Callback for gesture result
     */
    public void executeMultiStepGestureAtDevice(Point[] points, long durationMs, GestureResultCallback callback) {
        if (points == null || points.length < 2) {
            Log.e(TAG, "Multi-step gesture requires at least 2 points");
            if (callback != null) {
                callback.onCancelled();
            }
            return;
        }

        Path path = new Path();
        path.moveTo(points[0].x, points[0].y);
        
        for (int i = 1; i < points.length; i++) {
            path.lineTo(points[i].x, points[i].y);
        }

        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(
                path, 0, durationMs);

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), new AccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.d(TAG, "Multi-step gesture completed with " + points.length + " points");
                if (callback != null) {
                    callback.onCompleted();
                }
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "Multi-step gesture cancelled");
                if (callback != null) {
                    callback.onCancelled();
                }
            }
        }, null);
    }

    /**
     * Callback interface for gesture execution results.
     */
    public interface GestureResultCallback {
        void onCompleted();
        void onCancelled();
    }
}
