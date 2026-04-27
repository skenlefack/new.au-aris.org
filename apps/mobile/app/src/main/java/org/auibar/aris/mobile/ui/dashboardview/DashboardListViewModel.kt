package org.auibar.aris.mobile.ui.dashboardview

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
import org.auibar.aris.mobile.data.repository.DashboardMobileRepository
import javax.inject.Inject

@HiltViewModel
class DashboardListViewModel @Inject constructor(
    private val dashboardRepository: DashboardMobileRepository,
) : ViewModel() {

    val dashboards: StateFlow<List<DashboardEntity>> = dashboardRepository
        .observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            dashboardRepository.refreshDashboards()
            _isLoading.value = false
        }
    }
}
