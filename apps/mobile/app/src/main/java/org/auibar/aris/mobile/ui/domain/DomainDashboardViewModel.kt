package org.auibar.aris.mobile.ui.domain

import android.util.Log
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
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.IndicatorRepository
import org.auibar.aris.mobile.data.repository.FlashAlertRepository
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity
import org.auibar.aris.mobile.ui.components.RoleConfig
import javax.inject.Inject

data class DomainDashboardUiState(
    val isLoading: Boolean = true,
    val activeCampaigns: Int = 0,
    val totalSubmissions: Int = 0,
    val completionRate: Int = 0,
    val totalCampaigns: Int = 0,
    val formTemplates: List<FormTemplateSummaryDto> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class DomainDashboardViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val campaignApi: CampaignApi,
    private val indicatorRepository: IndicatorRepository,
    private val flashAlertRepository: FlashAlertRepository,
) : ViewModel() {

    val domainKey: String = savedStateHandle.get<String>("domainKey") ?: ""
    private val backendDomain: String = RoleConfig.mobileToBackendKey(domainKey)

    val config: DomainDashboardConfig = DomainDashboards.configFor(domainKey)

    val campaigns: StateFlow<List<Campaign>> = campaignRepository
        .getActiveCampaignsByDomain(domainKey)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val indicators: StateFlow<List<IndicatorEntity>> = indicatorRepository
        .observeByDomain(backendDomain)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val flashAlerts: StateFlow<List<FlashAlertEntity>> = flashAlertRepository
        .observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _uiState = MutableStateFlow(DomainDashboardUiState())
    val uiState: StateFlow<DomainDashboardUiState> = _uiState.asStateFlow()

    init {
        loadDomainData()
    }

    fun refresh() {
        loadDomainData()
    }

    private fun loadDomainData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            // Fetch campaigns for this domain from API
            try {
                val response = campaignApi.getCampaignsByDomain(backendDomain)
                val allCampaigns = response.data
                val active = allCampaigns.filter { it.status == "ACTIVE" }
                val totalSubs = allCampaigns.sumOf { it.targetSubmissions ?: 0 }
                val target = allCampaigns.sumOf { it.targetSubmissions ?: 0 }.coerceAtLeast(1)
                val completionPct = if (target > 0) ((totalSubs.toDouble() / target) * 100).toInt().coerceIn(0, 100) else 0

                _uiState.value = _uiState.value.copy(
                    activeCampaigns = active.size,
                    totalSubmissions = totalSubs,
                    completionRate = completionPct,
                    totalCampaigns = allCampaigns.size,
                )

                campaignRepository.refreshCampaigns()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load domain campaigns: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    error = "Failed to load campaigns: ${e.message}",
                )
            }

            // Fetch published form templates for this domain
            try {
                val templatesResponse = campaignApi.getPublishedTemplates(backendDomain)
                _uiState.value = _uiState.value.copy(
                    formTemplates = templatesResponse.data,
                )
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load form templates: ${e.message}")
            }

            // Refresh indicators for this domain
            try {
                indicatorRepository.refreshIndicators(backendDomain)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to refresh indicators: ${e.message}")
            }

            // Refresh flash alerts
            try {
                flashAlertRepository.refreshFromApi()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to refresh flash alerts: ${e.message}")
            }

            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    companion object {
        private const val TAG = "DomainDashboardVM"
    }
}
