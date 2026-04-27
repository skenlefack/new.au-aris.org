package org.auibar.aris.mobile.ui.flashalert

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity
import org.auibar.aris.mobile.data.repository.FlashAlertRepository
import javax.inject.Inject

@HiltViewModel
class FlashAlertListViewModel @Inject constructor(
    private val flashAlertRepository: FlashAlertRepository,
) : ViewModel() {

    val alerts: StateFlow<List<FlashAlertEntity>> = flashAlertRepository
        .observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val unreadCount: StateFlow<Int> = flashAlertRepository
        .observeUnreadCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    fun markAsRead(id: String) {
        viewModelScope.launch { flashAlertRepository.markAsRead(id) }
    }

    fun markAllAsRead() {
        viewModelScope.launch { flashAlertRepository.markAllAsRead() }
    }
}
