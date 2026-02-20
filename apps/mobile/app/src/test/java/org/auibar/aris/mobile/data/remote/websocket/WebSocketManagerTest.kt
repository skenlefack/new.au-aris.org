package org.auibar.aris.mobile.data.remote.websocket

import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.auibar.aris.mobile.util.TokenManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WebSocketManagerTest {

    private val tokenManager: TokenManager = mockk(relaxed = true)

    // ── Exponential backoff tests ──

    @Test
    fun `calculateBackoff returns 1000ms for first attempt`() {
        val delay = WebSocketManager.calculateBackoff(1)
        assertEquals(1000L, delay)
    }

    @Test
    fun `calculateBackoff returns 2000ms for second attempt`() {
        val delay = WebSocketManager.calculateBackoff(2)
        assertEquals(2000L, delay)
    }

    @Test
    fun `calculateBackoff returns 4000ms for third attempt`() {
        val delay = WebSocketManager.calculateBackoff(3)
        assertEquals(4000L, delay)
    }

    @Test
    fun `calculateBackoff returns 8000ms for fourth attempt`() {
        val delay = WebSocketManager.calculateBackoff(4)
        assertEquals(8000L, delay)
    }

    @Test
    fun `calculateBackoff caps at 30000ms`() {
        val delay = WebSocketManager.calculateBackoff(20)
        assertEquals(30_000L, delay)
    }

    @Test
    fun `calculateBackoff handles attempt zero`() {
        val delay = WebSocketManager.calculateBackoff(0)
        assertEquals(1000L, delay)
    }

    // ── Connection state tests ──

    @Test
    fun `initial state is DISCONNECTED`() {
        val manager = WebSocketManager(tokenManager)
        assertEquals(ConnectionState.DISCONNECTED, manager.connectionState.value)
    }

    @Test
    fun `connect does nothing when no token`() {
        every { tokenManager.accessToken } returns null
        every { tokenManager.tenantId } returns "tenant-1"
        every { tokenManager.userId } returns "user-1"

        val manager = WebSocketManager(tokenManager)
        manager.connect()

        assertEquals(ConnectionState.DISCONNECTED, manager.connectionState.value)
    }

    @Test
    fun `connect does nothing when no tenantId`() {
        every { tokenManager.accessToken } returns "token"
        every { tokenManager.tenantId } returns null
        every { tokenManager.userId } returns "user-1"

        val manager = WebSocketManager(tokenManager)
        manager.connect()

        assertEquals(ConnectionState.DISCONNECTED, manager.connectionState.value)
    }

    @Test
    fun `connect does nothing when no userId`() {
        every { tokenManager.accessToken } returns "token"
        every { tokenManager.tenantId } returns "tenant-1"
        every { tokenManager.userId } returns null

        val manager = WebSocketManager(tokenManager)
        manager.connect()

        assertEquals(ConnectionState.DISCONNECTED, manager.connectionState.value)
    }

    @Test
    fun `disconnect resets state to DISCONNECTED`() {
        val manager = WebSocketManager(tokenManager)
        manager.disconnect()

        assertEquals(ConnectionState.DISCONNECTED, manager.connectionState.value)
        assertEquals(0, manager.reconnectAttempt)
    }

    @Test
    fun `reconnectAttempt starts at zero`() {
        val manager = WebSocketManager(tokenManager)
        assertEquals(0, manager.reconnectAttempt)
    }

    // ── Event flow tests ──

    @Test
    fun `events flow is available`() {
        val manager = WebSocketManager(tokenManager)
        assertNotNull(manager.events)
    }

    // ── Backoff progression verification ──

    @Test
    fun `backoff progression follows exponential pattern`() {
        val expected = listOf(1000L, 2000L, 4000L, 8000L, 16000L, 30000L, 30000L)
        val actual = (1..7).map { WebSocketManager.calculateBackoff(it) }
        assertEquals(expected, actual)
    }
}
