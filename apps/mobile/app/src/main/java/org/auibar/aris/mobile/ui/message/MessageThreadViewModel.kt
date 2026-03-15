package org.auibar.aris.mobile.ui.message

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.MessageEntity
import org.auibar.aris.mobile.data.repository.MessageRepository
import javax.inject.Inject

data class MessageThreadUiState(
    val messages: List<MessageEntity> = emptyList(),
    val draftText: String = "",
    val threadId: String = "",
    val recipientId: String = "",
    val recipientName: String = "",
)

@HiltViewModel
class MessageThreadViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val messageRepository: MessageRepository,
) : ViewModel() {

    private val threadId: String = savedStateHandle["threadId"] ?: ""
    private val recipientId: String = savedStateHandle["recipientId"] ?: ""
    private val recipientName: String = savedStateHandle["recipientName"] ?: ""

    private val _draft = MutableStateFlow("")

    val uiState: StateFlow<MessageThreadUiState> = combine(
        messageRepository.getThread(threadId),
        _draft,
    ) { messages, draft ->
        MessageThreadUiState(
            messages = messages,
            draftText = draft,
            threadId = threadId,
            recipientId = recipientId,
            recipientName = recipientName,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MessageThreadUiState())

    init {
        viewModelScope.launch {
            messageRepository.markThreadRead(threadId)
        }
    }

    fun updateDraft(text: String) {
        _draft.value = text
    }

    fun send() {
        val body = _draft.value.trim()
        if (body.isEmpty()) return
        _draft.value = ""
        viewModelScope.launch {
            messageRepository.sendMessage(
                recipientId = recipientId,
                recipientName = recipientName,
                body = body,
            )
        }
    }
}
