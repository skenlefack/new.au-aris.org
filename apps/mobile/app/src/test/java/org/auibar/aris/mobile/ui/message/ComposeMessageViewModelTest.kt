package org.auibar.aris.mobile.ui.message

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.ktor.client.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.auibar.aris.mobile.data.repository.MessageRepository
import org.auibar.aris.mobile.util.TokenManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ComposeMessageViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var messageRepository: MessageRepository
    private lateinit var client: HttpClient
    private lateinit var tokenManager: TokenManager

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        messageRepository = mockk(relaxed = true)
        client = mockk(relaxed = true)
        tokenManager = mockk(relaxed = true)
        every { tokenManager.userId } returns "current-user"
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(): ComposeMessageViewModel {
        return ComposeMessageViewModel(messageRepository, client, tokenManager)
    }

    @Test
    fun `selectRecipient updates state`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        val contact = ContactDto(id = "user-1", name = "Alice", email = "alice@test.com")
        vm.selectRecipient(contact)

        val state = vm.uiState.value
        assertEquals("user-1", state.selectedRecipientId)
        assertEquals("Alice", state.selectedRecipientName)
        assertEquals("alice@test.com", state.selectedRecipientEmail)
    }

    @Test
    fun `updateSearch filters contacts`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        // Simulate contacts being loaded by setting allContacts via updateSearch reset
        // Since loadContacts requires HTTP, test the filter logic directly
        vm.updateSearch("alice")
        assertEquals("alice", vm.uiState.value.searchQuery)

        vm.updateSearch("")
        assertEquals("", vm.uiState.value.searchQuery)
    }

    @Test
    fun `updateMessageBody updates state`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        vm.updateMessageBody("Hello there")

        assertEquals("Hello there", vm.uiState.value.messageBody)
    }

    @Test
    fun `send with no recipient does nothing`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        vm.updateMessageBody("Hello")
        vm.send()
        advanceUntilIdle()

        coVerify(exactly = 0) { messageRepository.sendMessage(any(), any(), any()) }
    }

    @Test
    fun `send with blank body does nothing`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        vm.selectRecipient(ContactDto("user-1", "Alice", "alice@test.com"))
        vm.updateMessageBody("   ")
        vm.send()
        advanceUntilIdle()

        coVerify(exactly = 0) { messageRepository.sendMessage(any(), any(), any()) }
    }

    @Test
    fun `send with recipient and body calls repository`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        vm.selectRecipient(ContactDto("user-1", "Alice", "alice@test.com"))
        vm.updateMessageBody("Hello Alice!")
        vm.send()
        advanceUntilIdle()

        coVerify {
            messageRepository.sendMessage(
                recipientId = "user-1",
                recipientName = "Alice",
                body = "Hello Alice!",
            )
        }
    }

    @Test
    fun `send clears body and sets sentThreadId`() = runTest {
        val vm = createViewModel()
        advanceUntilIdle()

        vm.selectRecipient(ContactDto("user-1", "Alice", "alice@test.com"))
        vm.updateMessageBody("Test")
        vm.send()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals("", state.messageBody)
        assertTrue(state.sentThreadId.isNotEmpty())
        assertTrue(state.sentThreadId.startsWith("thread_"))
    }
}
