package org.auibar.aris.mobile.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.DashboardRepository
import javax.inject.Inject

@HiltViewModel
class HomeDashboardViewModel @Inject constructor(
    private val dashboardRepository: DashboardRepository,
) : ViewModel() {

    val pendingCount: StateFlow<Int> = dashboardRepository
        .getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _kpis = MutableStateFlow<List<KpiCard>>(emptyList())
    val kpis: StateFlow<List<KpiCard>> = _kpis.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadKpis()
    }

    private fun loadKpis() {
        viewModelScope.launch {
            _isLoading.value = true
            val result = dashboardRepository.getContinentalKpis()
            if (result.isSuccess) {
                _kpis.value = result.getOrDefault(emptyList())
            }
            _isLoading.value = false
        }
    }

    fun refresh() {
        loadKpis()
    }
}
