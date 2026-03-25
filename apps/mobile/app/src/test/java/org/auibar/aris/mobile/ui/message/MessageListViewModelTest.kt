package org.auibar.aris.mobile.ui.message

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.auibar.aris.mobile.data.local.entity.MessageEntity
import org.auibar.aris.mobile.data.repository.MessageRepository
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MessageListViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var messageRepository: MessageRepository

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        messageRepository = mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): MessageListViewModel {
        return MessageListViewModel(messageRepository)
    }

    private val sampleMessage = MessageEntity(
        id = "msg-1",
        threadId = "thread_a_b",
        senderId = "user-a",
        senderName = "Alice",
        recipientId = "user-b",
        recipientName = "Bob",
        body = "Hello",
        isRead = false,
        isOutgoing = false,
        createdAt = 1700000000000,
        syncStatus = "SYNCED",
    )

    @Test
    fun `init loads threads and unread count`() = runTest {
        every { messageRepository.getThreadPreviews() } returns flowOf(listOf(sampleMessage))
        every { messageRepository.getUnreadCount() } returns flowOf(3)

        val vm = createViewModel()
        val job = launch { vm.uiState.collect {} }
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(1, state.threads.size)
        assertEquals("msg-1", state.threads[0].id)
        assertEquals(3, state.unreadCount)
        assertFalse(state.isRefreshing)
        job.cancel()
    }

    @Test
    fun `init calls fetchMessages and syncPending`() = runTest {
        every { messageRepository.getThreadPreviews() } returns flowOf(emptyList())
        every { messageRepository.getUnreadCount() } returns flowOf(0)

        createViewModel()
        advanceUntilIdle()

        coVerify { messageRepository.fetchMessages() }
        coVerify { messageRepository.syncPending() }
    }

    @Test
    fun `refresh fetches and syncs messages`() = runTest {
        every { messageRepository.getThreadPreviews() } returns flowOf(emptyList())
        every { messageRepository.getUnreadCount() } returns flowOf(0)

        val vm = createViewModel()
        advanceUntilIdle()

        vm.refresh()
        advanceUntilIdle()

        // init + manual refresh = 2 calls each
        coVerify(exactly = 2) { messageRepository.fetchMessages() }
        coVerify(exactly = 2) { messageRepository.syncPending() }
    }

    @Test
    fun `empty threads list is reflected in state`() = runTest {
        every { messageRepository.getThreadPreviews() } returns flowOf(emptyList())
        every { messageRepository.getUnreadCount() } returns flowOf(0)

        val vm = createViewModel()
        advanceUntilIdle()

        assertEquals(0, vm.uiState.value.threads.size)
        assertEquals(0, vm.uiState.value.unreadCount)
    }
}
