package com.castmill.androidremote

import android.content.Context

/**
 * Example usage of DeviceUtils.getDeviceId()
 * 
 * This file demonstrates how to use the DeviceUtils class to get
 * the unique device identifier that matches Capacitor's Device.getId()
 * implementation.
 * 
 * This file is for documentation purposes only and is not used in the
 * actual application.
 */
object DeviceIdExample {
    
    /**
     * Example: Get device ID and send it to backend
     */
    fun exampleSendDeviceIdToBackend(context: Context) {
        // Get the unique device identifier
        val deviceId = DeviceUtils.getDeviceId(context)
        
        // The deviceId can now be sent to the backend to identify which
        // player's android-remote is connected
        println("Device ID: $deviceId")
        
        // Example: Send to backend (pseudocode)
        // websocket.send(json {
        //     "type" = "device_info"
        //     "deviceId" = deviceId
        // })
    }
    
    /**
     * Example: Use device ID for logging
     */
    fun exampleUseInLogging(context: Context) {
        val deviceId = DeviceUtils.getDeviceId(context)
        println("Android Remote started on device: $deviceId")
    }
    
    /**
     * Example: Verify device ID matches Capacitor behavior
     * 
     * This demonstrates that our getDeviceId() returns the same value
     * as Capacitor's Device.getId() would return.
     */
    fun exampleVerifyCapacitorCompatibility(context: Context) {
        val ourDeviceId = DeviceUtils.getDeviceId(context)
        
        // In the main Android player app, Capacitor would return:
        // const deviceId = await Device.getId();
        // return deviceId.identifier;
        //
        // Both would return the same Settings.Secure.ANDROID_ID value
        
        println("Device ID (identical to Capacitor): $ourDeviceId")
    }
}
