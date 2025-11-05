package com.castmill.androidremote

import android.content.Context
import android.provider.Settings

/**
 * DeviceUtils provides device-specific utility functions.
 * 
 * This implementation is based on the Capacitor Device plugin's getId() method,
 * which is used in the main Android player application.
 * 
 * Original code location:
 * - Capacitor Device Plugin: @capacitor/device npm package
 * - Used in: packages/platforms/android-player/src/ts/classes/android-machine.ts
 * - Method: getMachineGUID() which calls Device.getId()
 * 
 * The Capacitor Device plugin on Android returns the ANDROID_ID, which is a unique
 * 64-bit number (as a hex string) that remains constant for the lifetime of a device's
 * operating system (but is reset on factory reset).
 */
object DeviceUtils {
    
    /**
     * Get the unique device identifier.
     * 
     * This method returns the same device ID that Capacitor's Device.getId() returns,
     * which is the Android ANDROID_ID (Settings.Secure.ANDROID_ID).
     * 
     * @param context Android context required to access the secure settings
     * @return The unique device identifier as a String, or an empty string if unavailable
     */
    fun getDeviceId(context: Context): String {
        return try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        } catch (e: Exception) {
            // In case of any error accessing the secure settings, return empty string
            ""
        }
    }
}
