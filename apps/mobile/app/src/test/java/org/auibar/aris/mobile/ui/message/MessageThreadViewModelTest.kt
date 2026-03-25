package org.auibar.aris.mobile.ui.message

import androidx.lifecycle.SavedStateHandle
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
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MessageThreadViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var messageRepository: MessageRepository
    private val threadId = "thread_a_b"
    private val recipientId = "user-b"
    private val recipientName = "Bob"

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        messageRepository = mockk(relaxed = true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): MessageThreadViewModel {
        val savedStateHandle = SavedStateHandle(
            mapOf(
                "threadId" to threadId,
                "recipientId" to recipientId,
                "recipientName" to recipientName,
            ),
        )
        return MessageThreadViewModel(savedStateHandle, messageRepository)
    }

    private val sampleMessages = listOf(
        MessageEntity(
            id = "msg-1",
            threadId = threadId,
            senderId = "user-a",
            senderName = "Alice",
            recipientId = recipientId,
            recipientName = recipientName,
            body = "Hi Bob",
            isRead = true,
            isOutgoing = false,
            createdAt = 1700000000000,
            syncStatus = "SYNCED",
        ),
        MessageEntity(
            id = "msg-2",
            threadId = threadId,
            senderId = recipientId,
            senderName = recipientName,
            recipientId = "user-a",
            recipientName = "Alice",
            body = "Hi Alice",
            isRead = true,
            isOutgoing = true,
            createdAt = 1700000001000,
            syncStatus = "SYNCED",
        ),
    )

    @Test
    fun `init marks thread as read`() = runTest {
        every { messageRepository.getThread(threadId) } returns flowOf(sampleMessages)

        createViewModel()
        advanceUntilIdle()

        coVerify { messageRepository.markThreadRead(threadId) }
    }

    @Test
    fun `state contains thread messages and metadata`() = runTest {
        every { messageRepository.getThread(threadId) } returns flowOf(sampleMessages)

        val vm = createViewModel()
        val job = launch { vm.uiState.collect {} }
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(2, state.messages.size)
        assertEquals(threadId, state.threadId)
        assertEquals(recipientId, state.recipientId)
        assertEquals(recipientName, state.recipientName)
        job.cancel()
    }

    @Test
    fun `updateDraft changes draft text`() = runTest {
        every { messageRepository.getThread(threadId) } returns flowOf(emptyList())

        val vm = createViewModel()
        val job = launch { vm.uiState.collect {} }
        advanceUntilIdle()

        vm.updateDraft("Hello world")
        advanceUntilIdle()

        assertEquals("Hello world", vm.uiState.value.draftText)
        job.cancel()
    }

    @Test
    fun `send calls repository and clears draft`() = runTest {
        every { messageRepository.getThread(threadId) } returns flowOf(emptyList())

        val vm = createViewModel()
        val job = launch { vm.uiState.collect {} }
        advanceUntilIdle()

        vm.updateDraft("Test message")
        vm.send()
        advanceUntilIdle()

        coVerify {
            messageRepository.sendMessage(
                recipientId = recipientId,
                recipientName = recipientName,
                body = "Test message",
            )
        }
        assertEquals("", vm.uiState.value.draftText)
        job.cancel()
    }

    @Test
    fun `send with empty draft does nothing`() = runTest {
        every { messageRepository.getThread(threadId) } returns flowOf(emptyList())

        val vm = createViewModel()
        val job = launch { vm.uiState.collect {} }
        advanceUntilIdle()

        vm.updateDraft("   ")
        vm.send()
        advanceUntilIdle()

        coVerify(exactly = 0) { messageRepository.sendMessage(any(), any(), any()) }
        job.cancel()
    }
}
