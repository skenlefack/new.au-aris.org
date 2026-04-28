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
import org.auibar.aris.mobile.data.local.dao.DashboardWidgetDao
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardMobileRepository
import org.auibar.aris.mobile.ui.components.RoleConfig
import javax.inject.Inject

data class DomainDashboardUiState(
    val isLoading: Boolean = true,
    val isDashboardLoading: Boolean = true,
    val activeCampaigns: Int = 0,
    val totalSubmissions: Int = 0,
    val completionRate: Int = 0,
    val totalCampaigns: Int = 0,
    val formTemplates: List<FormTemplateSummaryDto> = emptyList(),
    val defaultDashboardId: String? = null,
    val error: String? = null,
)

@HiltViewModel
class DomainDashboardViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val campaignApi: CampaignApi,
    private val dashboardRepository: DashboardMobileRepository,
    private val dashboardWidgetDao: DashboardWidgetDao,
) : ViewModel() {

    val domainKey: String = savedStateHandle.get<String>("domainKey") ?: ""
    private val backendDomain: String = RoleConfig.mobileToBackendKey(domainKey)

    val config: DomainDashboardConfig = DomainDashboards.configFor(domainKey)

    /** All campaigns for this domain (all statuses for tab filtering). */
    val allCampaigns: StateFlow<List<Campaign>> = campaignRepository
        .getAllCampaignsByDomain(domainKey)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _dashboardWidgets = MutableStateFlow<List<DashboardWidgetEntity>>(emptyList())
    val dashboardWidgets: StateFlow<List<DashboardWidgetEntity>> = _dashboardWidgets.asStateFlow()

    private val _uiState = MutableStateFlow(DomainDashboardUiState())
    val uiState: StateFlow<DomainDashboardUiState> = _uiState.asStateFlow()

    init {
        loadAll()
    }

    fun refresh() {
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, isDashboardLoading = true, error = null)

            // Load dashboard (personalized widgets)
            loadDashboard()

            // Load campaigns
            loadCampaigns()

            // Load form templates
            loadFormTemplates()

            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadDashboard() {
        try {
            // Refresh dashboards list
            dashboardRepository.refreshDashboards()

            // Find the default dashboard for this domain (by domainCode match)
            val allDashboards = dashboardRepository.observeAll()
                .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
                .value

            val domainDashboard = allDashboards.find { it.domainCode == backendDomain }
                ?: allDashboards.find { it.isDefault }
                ?: allDashboards.firstOrNull()

            if (domainDashboard != null) {
                _uiState.value = _uiState.value.copy(defaultDashboardId = domainDashboard.id)

                // Render and cache the dashboard (fetch widgets)
                val result = dashboardRepository.renderAndCache(domainDashboard.id)
                if (result.isSuccess) {
                    // Map backend types to mobile types
                    val widgets = result.getOrNull() ?: emptyList()
                    _dashboardWidgets.value = widgets.sortedWith(compareBy({ it.gridY }, { it.gridX }))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load dashboard: ${e.message}")
        }
        _uiState.value = _uiState.value.copy(isDashboardLoading = false)
    }

    private suspend fun loadCampaigns() {
        try {
            val response = campaignApi.getCampaignsByDomain(backendDomain)
            val allCampaigns = response.data
            val active = allCampaigns.filter { it.status == "ACTIVE" }
            val totalSubs = allCampaigns.sumOf { it.targetSubmissions ?: 0 }
            val target = totalSubs.coerceAtLeast(1)
            val completionPct = if (target > 0) ((totalSubs.toDouble() / target) * 100).toInt().coerceIn(0, 100) else 0

            _uiState.value = _uiState.value.copy(
                activeCampaigns = active.size,
                totalSubmissions = totalSubs,
                completionRate = completionPct,
                totalCampaigns = allCampaigns.size,
            )

            campaignRepository.refreshCampaigns()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load campaigns: ${e.message}")
            _uiState.value = _uiState.value.copy(error = e.message)
        }
    }

    private suspend fun loadFormTemplates() {
        try {
            val templatesResponse = campaignApi.getPublishedTemplates(backendDomain)
            _uiState.value = _uiState.value.copy(formTemplates = templatesResponse.data)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load form templates: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "DomainDashboardVM"
    }
}
