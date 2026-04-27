package org.auibar.aris.mobile.ui.dashboardview

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.DashboardEntity
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.repository.DashboardMobileRepository
import javax.inject.Inject

@HiltViewModel
class DashboardViewViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val dashboardRepository: DashboardMobileRepository,
) : ViewModel() {

    private val dashboardId: String = savedStateHandle["dashboardId"] ?: ""

    val dashboard: StateFlow<DashboardEntity?> = dashboardRepository
        .observeById(dashboardId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val widgets: StateFlow<List<DashboardWidgetEntity>> = dashboardRepository
        .observeWidgets(dashboardId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            dashboardRepository.renderAndCache(dashboardId)
            _isLoading.value = false
        }
    }
}
