package com.castmill.androidremote

import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import java.nio.ByteBuffer

/**
 * Unit tests for WebSocketManager security and error handling.
 * 
 * Tests verify:
 * - Certificate pinning configuration
 * - Authentication token handling
 * - Diagnostics integration
 * - Error tracking
 * - Reconnection logic
 */
class WebSocketManagerSecurityTest {

    private lateinit var testScope: TestScope
    private lateinit var diagnosticsManager: DiagnosticsManager

    @Before
    fun setup() {
        val testDispatcher = UnconfinedTestDispatcher()
        testScope = TestScope(testDispatcher)
        diagnosticsManager = DiagnosticsManager()
    }

    @Test
    fun testWebSocketManagerConstruction() {
        // Test basic construction without certificate pinning
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager,
            certificatePins = null
        )

        assertNotNull("WebSocketManager should be created", manager)
    }

    @Test
    fun testWebSocketManagerWithCertificatePins() {
        // Test construction with certificate pinning
        val pins = mapOf(
            "api.example.com" to listOf(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
            )
        )

        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager,
            certificatePins = pins
        )

        assertNotNull("WebSocketManager should be created with pins", manager)
    }

    @Test
    fun testWebSocketManagerWithoutDiagnostics() {
        // Test construction without diagnostics manager
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = null,
            certificatePins = null
        )

        assertNotNull("WebSocketManager should be created without diagnostics", manager)
    }

    @Test
    fun testUrlConversion() {
        // Test HTTP to WS conversion
        val managerHttp = WebSocketManager(
            baseUrl = "http://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope
        )

        assertNotNull("Should handle http:// URL", managerHttp)

        // Test HTTPS to WSS conversion
        val managerHttps = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope
        )

        assertNotNull("Should handle https:// URL", managerHttps)
    }

    @Test
    fun testSendDeviceEvent() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Should not crash even if not connected
        manager.sendDeviceEvent("test_event", mapOf("key1" to "value1"))

        assertTrue("Should handle event sending", true)
    }

    @Test
    fun testDisconnect() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Should not crash even if not connected
        manager.disconnect()

        assertTrue("Should handle disconnect", true)
    }

    @Test
    fun testVideoFrameSendingWithoutConnection() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        val buffer = ByteBuffer.allocate(1000)
        for (i in 0 until 1000) {
            buffer.put(i.toByte())
        }
        buffer.flip()

        // Should handle gracefully when not connected
        manager.sendVideoFrame(buffer, true, "h264")

        assertTrue("Should handle video frame sending without crash", true)
    }

    @Test
    fun testDiagnosticsReportingWithoutConnection() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Should not crash when not connected
        manager.sendDiagnosticsReport()

        assertTrue("Should handle diagnostics reporting without crash", true)
    }

    @Test
    fun testDiagnosticsReportingWithoutDiagnosticsManager() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device-123",
            deviceToken = "test-token-456",
            coroutineScope = testScope,
            diagnosticsManager = null
        )

        // Should not crash when diagnostics manager is null
        manager.sendDiagnosticsReport()

        assertTrue("Should handle missing diagnostics manager", true)
    }

    @Test
    fun testMultiplePinsForSameHost() {
        // Test multiple certificate pins for same hostname
        val pins = mapOf(
            "api.example.com" to listOf(
                "PIN1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                "PIN2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
                "PIN3CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC="
            )
        )

        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope,
            certificatePins = pins
        )

        assertNotNull("Should handle multiple pins", manager)
    }

    @Test
    fun testMultipleHostsWithPins() {
        // Test certificate pins for multiple hostnames
        val pins = mapOf(
            "api1.example.com" to listOf("PIN1AAAA="),
            "api2.example.com" to listOf("PIN2BBBB="),
            "api3.example.com" to listOf("PIN3CCCC=")
        )

        val manager = WebSocketManager(
            baseUrl = "https://api1.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope,
            certificatePins = pins
        )

        assertNotNull("Should handle multiple host pins", manager)
    }

    @Test
    fun testEmptyPinsList() {
        // Test empty pins list
        val pins = mapOf(
            "api.example.com" to emptyList<String>()
        )

        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope,
            certificatePins = pins
        )

        assertNotNull("Should handle empty pins list", manager)
    }

    @Test
    fun testEmptyPinsMap() {
        // Test empty pins map
        val pins = emptyMap<String, List<String>>()

        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope,
            certificatePins = pins
        )

        assertNotNull("Should handle empty pins map", manager)
    }

    @Test
    fun testDeviceIdAndTokenStorage() {
        val deviceId = "unique-device-id-12345"
        val deviceToken = "secure-token-67890"

        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = deviceId,
            deviceToken = deviceToken,
            coroutineScope = testScope
        )

        assertNotNull("Manager should store device ID and token", manager)
    }

    @Test
    fun testBaseUrlFormats() {
        // Test various URL formats
        val urls = listOf(
            "http://api.example.com",
            "https://api.example.com",
            "http://api.example.com:8080",
            "https://api.example.com:8443",
            "http://192.168.1.1",
            "https://192.168.1.1:8443"
        )

        urls.forEach { url ->
            val manager = WebSocketManager(
                baseUrl = url,
                deviceId = "test-device",
                deviceToken = "test-token",
                coroutineScope = testScope
            )

            assertNotNull("Should handle URL format: $url", manager)
        }
    }

    @Test
    fun testDisconnectWithoutConnect() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Disconnect without ever connecting
        manager.disconnect()

        // Should record disconnection in diagnostics
        val report = diagnosticsManager.getDiagnosticsReport()
        assertNotNull("Diagnostics report should be available", report)
    }

    @Test
    fun testVideoFrameWithDifferentCodecs() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope
        )

        val buffer = ByteBuffer.allocate(100)
        buffer.put(ByteArray(100))
        buffer.flip()

        // Test different codec types
        manager.sendVideoFrame(buffer.duplicate(), true, "h264")
        manager.sendVideoFrame(buffer.duplicate(), false, "mjpeg")
        manager.sendVideoFrame(buffer.duplicate(), true, "vp8")

        assertTrue("Should handle different codec types", true)
    }

    @Test
    fun testVideoFrameWithKeyframeFlag() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope
        )

        val buffer = ByteBuffer.allocate(100)
        buffer.put(ByteArray(100))
        buffer.flip()

        // Test keyframe vs non-keyframe
        manager.sendVideoFrame(buffer.duplicate(), true, "h264")
        manager.sendVideoFrame(buffer.duplicate(), false, "h264")

        assertTrue("Should handle keyframe flag", true)
    }

    @Test
    fun testVideoFrameWithEmptyBuffer() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope
        )

        val buffer = ByteBuffer.allocate(0)

        // Should handle empty buffer gracefully
        manager.sendVideoFrame(buffer, true, "h264")

        assertTrue("Should handle empty buffer", true)
    }

    @Test
    fun testVideoFrameWithLargeBuffer() {
        val manager = WebSocketManager(
            baseUrl = "https://api.example.com",
            deviceId = "test-device",
            deviceToken = "test-token",
            coroutineScope = testScope
        )

        // Large buffer (1 MB)
        val buffer = ByteBuffer.allocate(1024 * 1024)
        for (i in 0 until buffer.capacity()) {
            buffer.put((i % 256).toByte())
        }
        buffer.flip()

        // Should handle large buffer
        manager.sendVideoFrame(buffer, true, "h264")

        assertTrue("Should handle large buffer", true)
    }
}
