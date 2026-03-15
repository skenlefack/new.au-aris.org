package org.auibar.aris.mobile.ui.message

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

data class MessageListUiState(
    val threads: List<MessageEntity> = emptyList(),
    val unreadCount: Int = 0,
    val isRefreshing: Boolean = false,
)

@HiltViewModel
class MessageListViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
) : ViewModel() {

    private val _isRefreshing = MutableStateFlow(false)

    val uiState: StateFlow<MessageListUiState> = combine(
        messageRepository.getThreadPreviews(),
        messageRepository.getUnreadCount(),
        _isRefreshing,
    ) { threads, unread, refreshing ->
        MessageListUiState(
            threads = threads,
            unreadCount = unread,
            isRefreshing = refreshing,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MessageListUiState())

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            messageRepository.fetchMessages()
            messageRepository.syncPending()
            _isRefreshing.value = false
        }
    }
}
