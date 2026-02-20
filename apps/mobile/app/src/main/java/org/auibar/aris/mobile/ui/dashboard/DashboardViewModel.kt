package org.auibar.aris.mobile.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.cache.CampaignRefresher
import org.auibar.aris.mobile.data.cache.MasterDataRefresher
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.DashboardRepository
import javax.inject.Inject

data class DashboardUiState(
    val kpis: List<KpiCard> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val dashboardRepository: DashboardRepository,
    private val masterDataRefresher: MasterDataRefresher,
    private val campaignRefresher: CampaignRefresher,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    val recentCampaigns: StateFlow<List<Campaign>> = dashboardRepository
        .getActiveCampaigns()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val pendingCount: StateFlow<Int> = dashboardRepository
        .getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    init {
        viewModelScope.launch {
            masterDataRefresher.refreshIfNeeded()
            campaignRefresher.refreshIfNeeded()
        }
        loadKpis()
    }

    fun loadKpis() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = dashboardRepository.getKpis()
            _uiState.value = if (result.isSuccess) {
                _uiState.value.copy(
                    kpis = result.getOrDefault(emptyList()),
                    isLoading = false,
                )
            } else {
                _uiState.value.copy(
                    isLoading = false,
                    error = result.exceptionOrNull()?.message,
                )
            }
        }
    }
}
