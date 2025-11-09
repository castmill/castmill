package com.castmill.android.app.remote;

import android.content.Context;
import android.graphics.Point;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.Surface;
import android.view.WindowManager;

/**
 * Maps remote control window coordinates to device screen coordinates.
 * Handles display rotation, letterboxing, and different screen resolutions.
 */
public class CoordinateMapper {
    private final Context context;
    private int remoteWidth;
    private int remoteHeight;

    public CoordinateMapper(Context context) {
        this.context = context;
    }

    /**
     * Sets the remote control window dimensions.
     *
     * @param width  Remote window width in pixels
     * @param height Remote window height in pixels
     */
    public void setRemoteDimensions(int width, int height) {
        this.remoteWidth = width;
        this.remoteHeight = height;
    }

    /**
     * Gets the current device screen dimensions accounting for rotation.
     *
     * @return Point containing width and height
     */
    public Point getDeviceDimensions() {
        WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        Display display = windowManager.getDefaultDisplay();
        Point size = new Point();
        display.getRealSize(size);
        return size;
    }

    /**
     * Gets the current display rotation.
     *
     * @return One of Surface.ROTATION_0, ROTATION_90, ROTATION_180, ROTATION_270
     */
    public int getDisplayRotation() {
        WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        return windowManager.getDefaultDisplay().getRotation();
    }

    /**
     * Maps a point from remote control coordinates to device screen coordinates.
     * Handles aspect ratio differences through letterboxing.
     *
     * @param remoteX X coordinate in remote window
     * @param remoteY Y coordinate in remote window
     * @return Point containing device screen coordinates
     */
    public Point mapToDevice(float remoteX, float remoteY) {
        if (remoteWidth <= 0 || remoteHeight <= 0) {
            throw new IllegalStateException("Remote dimensions not set");
        }

        Point deviceSize = getDeviceDimensions();
        
        // Calculate aspect ratios
        float remoteAspect = (float) remoteWidth / remoteHeight;
        float deviceAspect = (float) deviceSize.x / deviceSize.y;

        float scaleX, scaleY;
        float offsetX = 0, offsetY = 0;

        if (Math.abs(remoteAspect - deviceAspect) < 0.01f) {
            // Aspect ratios match - simple scaling
            scaleX = (float) deviceSize.x / remoteWidth;
            scaleY = (float) deviceSize.y / remoteHeight;
        } else if (remoteAspect > deviceAspect) {
            // Remote is wider - letterbox top/bottom
            scaleX = (float) deviceSize.x / remoteWidth;
            scaleY = scaleX;
            float scaledHeight = remoteHeight * scaleY;
            offsetY = (deviceSize.y - scaledHeight) / 2;
        } else {
            // Remote is taller - letterbox left/right
            scaleY = (float) deviceSize.y / remoteHeight;
            scaleX = scaleY;
            float scaledWidth = remoteWidth * scaleX;
            offsetX = (deviceSize.x - scaledWidth) / 2;
        }

        // Apply scaling and offset
        float deviceX = remoteX * scaleX + offsetX;
        float deviceY = remoteY * scaleY + offsetY;

        // Clamp to device bounds
        deviceX = Math.max(0, Math.min(deviceSize.x - 1, deviceX));
        deviceY = Math.max(0, Math.min(deviceSize.y - 1, deviceY));

        return new Point(Math.round(deviceX), Math.round(deviceY));
    }

    /**
     * Maps multiple points from remote to device coordinates.
     *
     * @param remotePoints Array of Points in remote coordinates
     * @return Array of Points in device coordinates
     */
    public Point[] mapToDevice(Point[] remotePoints) {
        Point[] devicePoints = new Point[remotePoints.length];
        for (int i = 0; i < remotePoints.length; i++) {
            devicePoints[i] = mapToDevice(remotePoints[i].x, remotePoints[i].y);
        }
        return devicePoints;
    }

    /**
     * Calculates the letterbox offsets for the current configuration.
     *
     * @return Point containing horizontal and vertical offsets
     */
    public Point getLetterboxOffset() {
        if (remoteWidth <= 0 || remoteHeight <= 0) {
            return new Point(0, 0);
        }

        Point deviceSize = getDeviceDimensions();
        float remoteAspect = (float) remoteWidth / remoteHeight;
        float deviceAspect = (float) deviceSize.x / deviceSize.y;

        if (Math.abs(remoteAspect - deviceAspect) < 0.01f) {
            return new Point(0, 0);
        } else if (remoteAspect > deviceAspect) {
            // Letterbox top/bottom
            float scale = (float) deviceSize.x / remoteWidth;
            float scaledHeight = remoteHeight * scale;
            int offsetY = Math.round((deviceSize.y - scaledHeight) / 2);
            return new Point(0, offsetY);
        } else {
            // Letterbox left/right
            float scale = (float) deviceSize.y / remoteHeight;
            float scaledWidth = remoteWidth * scale;
            int offsetX = Math.round((deviceSize.x - scaledWidth) / 2);
            return new Point(offsetX, 0);
        }
    }

    /**
     * Gets the scale factor applied when mapping coordinates.
     *
     * @return Point containing x and y scale factors (multiplied by 1000 for precision)
     */
    public Point getScaleFactor() {
        if (remoteWidth <= 0 || remoteHeight <= 0) {
            return new Point(1000, 1000);
        }

        Point deviceSize = getDeviceDimensions();
        float remoteAspect = (float) remoteWidth / remoteHeight;
        float deviceAspect = (float) deviceSize.x / deviceSize.y;

        float scaleX, scaleY;

        if (Math.abs(remoteAspect - deviceAspect) < 0.01f) {
            scaleX = (float) deviceSize.x / remoteWidth;
            scaleY = (float) deviceSize.y / remoteHeight;
        } else if (remoteAspect > deviceAspect) {
            scaleX = (float) deviceSize.x / remoteWidth;
            scaleY = scaleX;
        } else {
            scaleY = (float) deviceSize.y / remoteHeight;
            scaleX = scaleY;
        }

        return new Point((int) (scaleX * 1000), (int) (scaleY * 1000));
    }
}
