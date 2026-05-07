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
import org.auibar.aris.mobile.data.remote.api.DashboardChartsResponse
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.DashboardRepository
import org.auibar.aris.mobile.ui.components.DomainInfo
import org.auibar.aris.mobile.ui.components.getActiveDomains
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

@HiltViewModel
class HomeDashboardViewModel @Inject constructor(
    private val dashboardRepository: DashboardRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    val pendingCount: StateFlow<Int> = dashboardRepository
        .getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val userDomains: List<String> = tokenManager.getUserDomainList()
    val activeDomains: List<DomainInfo> = getActiveDomains(tokenManager)

    private val _kpis = MutableStateFlow<List<KpiCard>>(emptyList())
    val kpis: StateFlow<List<KpiCard>> = _kpis.asStateFlow()

    private val _charts = MutableStateFlow(DashboardChartsResponse())
    val charts: StateFlow<DashboardChartsResponse> = _charts.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            // Load KPIs and charts in parallel
            val kpiJob = launch {
                val result = dashboardRepository.getContinentalKpis()
                if (result.isSuccess) {
                    _kpis.value = result.getOrDefault(emptyList())
                }
            }
            val chartsJob = launch {
                val result = dashboardRepository.getCharts()
                if (result.isSuccess) {
                    _charts.value = result.getOrDefault(DashboardChartsResponse())
                }
            }
            kpiJob.join()
            chartsJob.join()
            _isLoading.value = false
        }
    }

    fun refresh() {
        loadAll()
    }
}
