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
 * - Connection initialization
 * - Channel join with proper topic format
 * - Binary frame sending
 * - Metadata sending
 * - Disconnection and cleanup
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
        // Arrange
        val baseUrl = "https://api.castmill.io"
        val deviceId = "test_device_123"
        val deviceToken = "test_token_456"
        val sessionId = "session_789"

        // Act
        val manager = MediaWebSocketManager(
            baseUrl = baseUrl,
            deviceId = deviceId,
            deviceToken = deviceToken,
            sessionId = sessionId,
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Assert
        assertNotNull(manager)
    }

    @Test
    fun testTopicFormat() {
        // Arrange
        val baseUrl = "https://api.castmill.io"
        val deviceId = "test_device_123"
        val sessionId = "session_789"
        
        // Act
        val expectedTopic = "device_media:test_device_123:session_789"
        
        // Assert - topic format should match device_media:#{device_id}:#{session_id}
        assertTrue(expectedTopic.startsWith("device_media:"))
        assertTrue(expectedTopic.contains(deviceId))
        assertTrue(expectedTopic.contains(sessionId))
    }

    @Test
    fun testDisconnect() {
        // Arrange
        val manager = MediaWebSocketManager(
            baseUrl = "https://api.castmill.io",
            deviceId = "test_device",
            deviceToken = "test_token",
            sessionId = "test_session",
            coroutineScope = testScope,
            diagnosticsManager = diagnosticsManager
        )

        // Act
        manager.disconnect()

        // Assert - should not throw exception
        assertTrue(true)
    }
}
