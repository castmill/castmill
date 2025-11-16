package com.castmill.androidremote

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*

/**
 * Unit tests for MediaWebSocketManager.
 * 
 * These tests verify:
 * - Manager initialization with required parameters
 * - Disconnection cleanup behavior
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MediaWebSocketManagerTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var testScope: TestScope
    private lateinit var diagnosticsManager: DiagnosticsManager

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        testScope = TestScope(testDispatcher)
        diagnosticsManager = DiagnosticsManager()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun testMediaWebSocketManagerCreation() {
        // Verify manager can be created with all required parameters
        val baseUrl = "https://api.castmill.io"
        val deviceId = "test_device_123"
        val deviceToken = "test_token_456"
        val sessionId = "session_789"

        val manager = MediaWebSocketManager(
            baseUrl = baseUrl,
            deviceId = deviceId,
            deviceToken = deviceToken,
            sessionId = sessionId,
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        assertNotNull("MediaWebSocketManager should be created", manager)
    }

    @Test
    fun testDisconnectDoesNotThrow() {
        // Verify disconnect can be called without errors even if never connected
        val manager = MediaWebSocketManager(
            baseUrl = "https://api.castmill.io",
            deviceId = "test_device",
            deviceToken = "test_token",
            sessionId = "test_session",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Should not throw exception when disconnecting without prior connection
        try {
            manager.disconnect()
            // Test passes if no exception is thrown
        } catch (e: Exception) {
            fail("disconnect() should not throw exception: ${e.message}")
        }
    }
}
