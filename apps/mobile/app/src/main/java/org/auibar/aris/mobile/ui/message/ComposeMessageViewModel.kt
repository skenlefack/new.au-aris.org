package org.auibar.aris.mobile.ui.message

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import org.auibar.aris.mobile.data.remote.dto.ApiResponse
import org.auibar.aris.mobile.data.repository.MessageRepository
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@Serializable
data class ContactDto(
    val id: String,
    val name: String,
    val email: String,
    val role: String = "",
)

data class ComposeMessageUiState(
    val searchQuery: String = "",
    val contacts: List<ContactDto> = emptyList(),
    val selectedRecipientId: String = "",
    val selectedRecipientName: String = "",
    val selectedRecipientEmail: String = "",
    val messageBody: String = "",
    val sentThreadId: String = "",
    val isLoading: Boolean = false,
)

@HiltViewModel
class ComposeMessageViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val client: HttpClient,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ComposeMessageUiState())
    val uiState: StateFlow<ComposeMessageUiState> = _uiState.asStateFlow()

    private var allContacts: List<ContactDto> = emptyList()

    init {
        loadContacts()
    }

    private fun loadContacts() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response: ApiResponse<List<ContactDto>> = client.get("/api/v1/credential/users") {
                    parameter("limit", 200)
                }.body()
                allContacts = response.data.filter { it.id != tokenManager.userId }
                _uiState.value = _uiState.value.copy(contacts = allContacts, isLoading = false)
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun updateSearch(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        if (query.isBlank()) {
            _uiState.value = _uiState.value.copy(contacts = allContacts)
        } else {
            val filtered = allContacts.filter {
                it.name.contains(query, ignoreCase = true) ||
                    it.email.contains(query, ignoreCase = true)
            }
            _uiState.value = _uiState.value.copy(contacts = filtered)
        }
    }

    fun selectRecipient(contact: ContactDto) {
        _uiState.value = _uiState.value.copy(
            selectedRecipientId = contact.id,
            selectedRecipientName = contact.name,
            selectedRecipientEmail = contact.email,
        )
    }

    fun updateMessageBody(body: String) {
        _uiState.value = _uiState.value.copy(messageBody = body)
    }

    fun send() {
        val state = _uiState.value
        if (state.selectedRecipientId.isEmpty() || state.messageBody.isBlank()) return

        viewModelScope.launch {
            messageRepository.sendMessage(
                recipientId = state.selectedRecipientId,
                recipientName = state.selectedRecipientName,
                body = state.messageBody.trim(),
            )

            val userId = tokenManager.userId ?: ""
            val participants = listOf(userId, state.selectedRecipientId).sorted()
            val threadId = "thread_${participants.joinToString("_")}"

            _uiState.value = _uiState.value.copy(
                messageBody = "",
                sentThreadId = threadId,
            )
        }
    }
}
