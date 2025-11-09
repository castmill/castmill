package com.castmill.android.app.remote;

import android.graphics.Point;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Capacitor plugin for remote input control via AccessibilityService.
 * Provides methods to execute gestures and configure coordinate mapping.
 */
@CapacitorPlugin(name = "RemoteInput")
public class RemoteInputPlugin extends Plugin {
    private static final String TAG = "RemoteInputPlugin";

    /**
     * Sets the remote control window dimensions for coordinate mapping.
     *
     * @param call Plugin call containing width and height
     */
    @PluginMethod
    public void setRemoteDimensions(PluginCall call) {
        Integer width = call.getInt("width");
        Integer height = call.getInt("height");

        if (width == null || height == null) {
            call.reject("Width and height are required");
            return;
        }

        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        service.getCoordinateMapper().setRemoteDimensions(width, height);
        
        JSObject result = new JSObject();
        result.put("width", width);
        result.put("height", height);
        call.resolve(result);
    }

    /**
     * Gets the current device screen dimensions.
     *
     * @param call Plugin call
     */
    @PluginMethod
    public void getDeviceDimensions(PluginCall call) {
        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        Point dimensions = service.getCoordinateMapper().getDeviceDimensions();
        
        JSObject result = new JSObject();
        result.put("width", dimensions.x);
        result.put("height", dimensions.y);
        call.resolve(result);
    }

    /**
     * Gets the current display rotation.
     *
     * @param call Plugin call
     */
    @PluginMethod
    public void getDisplayRotation(PluginCall call) {
        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        int rotation = service.getCoordinateMapper().getDisplayRotation();
        
        JSObject result = new JSObject();
        result.put("rotation", rotation);
        call.resolve(result);
    }

    /**
     * Executes a tap gesture at the specified coordinates.
     *
     * @param call Plugin call containing x and y coordinates
     */
    @PluginMethod
    public void executeTap(PluginCall call) {
        Double x = call.getDouble("x");
        Double y = call.getDouble("y");

        if (x == null || y == null) {
            call.reject("X and Y coordinates are required");
            return;
        }

        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        service.executeTap(x.floatValue(), y.floatValue(), new RemoteInputAccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted() {
                call.resolve();
            }

            @Override
            public void onCancelled() {
                call.reject("Gesture cancelled");
            }
        });
    }

    /**
     * Executes a long press gesture at the specified coordinates.
     *
     * @param call Plugin call containing x and y coordinates
     */
    @PluginMethod
    public void executeLongPress(PluginCall call) {
        Double x = call.getDouble("x");
        Double y = call.getDouble("y");

        if (x == null || y == null) {
            call.reject("X and Y coordinates are required");
            return;
        }

        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        service.executeLongPress(x.floatValue(), y.floatValue(), new RemoteInputAccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted() {
                call.resolve();
            }

            @Override
            public void onCancelled() {
                call.reject("Gesture cancelled");
            }
        });
    }

    /**
     * Executes a swipe gesture between two points.
     *
     * @param call Plugin call containing x1, y1, x2, y2, and optional duration
     */
    @PluginMethod
    public void executeSwipe(PluginCall call) {
        Double x1 = call.getDouble("x1");
        Double y1 = call.getDouble("y1");
        Double x2 = call.getDouble("x2");
        Double y2 = call.getDouble("y2");
        Integer duration = call.getInt("duration", 300);

        if (x1 == null || y1 == null || x2 == null || y2 == null) {
            call.reject("Start and end coordinates are required");
            return;
        }

        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        service.executeSwipe(x1.floatValue(), y1.floatValue(), x2.floatValue(), y2.floatValue(), 
                duration, new RemoteInputAccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted() {
                call.resolve();
            }

            @Override
            public void onCancelled() {
                call.reject("Gesture cancelled");
            }
        });
    }

    /**
     * Executes a multi-step gesture following a path of points.
     *
     * @param call Plugin call containing points array and duration
     */
    @PluginMethod
    public void executeMultiStepGesture(PluginCall call) {
        JSArray pointsArray = call.getArray("points");
        Integer duration = call.getInt("duration", 500);

        if (pointsArray == null || pointsArray.length() < 2) {
            call.reject("At least 2 points are required");
            return;
        }

        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        try {
            Point[] points = new Point[pointsArray.length()];
            for (int i = 0; i < pointsArray.length(); i++) {
                JSONObject pointObj = pointsArray.getJSONObject(i);
                int x = pointObj.getInt("x");
                int y = pointObj.getInt("y");
                points[i] = new Point(x, y);
            }

            service.executeMultiStepGesture(points, duration, new RemoteInputAccessibilityService.GestureResultCallback() {
                @Override
                public void onCompleted() {
                    call.resolve();
                }

                @Override
                public void onCancelled() {
                    call.reject("Gesture cancelled");
                }
            });
        } catch (JSONException e) {
            Log.e(TAG, "Error parsing points array", e);
            call.reject("Invalid points array format");
        }
    }

    /**
     * Checks if the accessibility service is running.
     *
     * @param call Plugin call
     */
    @PluginMethod
    public void isServiceRunning(PluginCall call) {
        boolean isRunning = RemoteInputAccessibilityService.getInstance() != null;
        JSObject result = new JSObject();
        result.put("isRunning", isRunning);
        call.resolve(result);
    }

    /**
     * Gets information about coordinate mapping configuration.
     *
     * @param call Plugin call
     */
    @PluginMethod
    public void getMappingInfo(PluginCall call) {
        RemoteInputAccessibilityService service = RemoteInputAccessibilityService.getInstance();
        if (service == null) {
            call.reject("Accessibility service not running");
            return;
        }

        CoordinateMapper mapper = service.getCoordinateMapper();
        Point deviceSize = mapper.getDeviceDimensions();
        Point offset = mapper.getLetterboxOffset();
        Point scaleFactor = mapper.getScaleFactor();
        
        JSObject result = new JSObject();
        result.put("deviceWidth", deviceSize.x);
        result.put("deviceHeight", deviceSize.y);
        result.put("offsetX", offset.x);
        result.put("offsetY", offset.y);
        result.put("scaleX", scaleFactor.x / 1000.0);
        result.put("scaleY", scaleFactor.y / 1000.0);
        
        call.resolve(result);
    }
}
