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
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardMobileRepository
import org.auibar.aris.mobile.data.repository.toEntity
import org.auibar.aris.mobile.ui.components.RoleConfig
import javax.inject.Inject

data class SubDomainUi(
    val id: String,
    val code: String,
    val labelEn: String,
    val labelFr: String,
    val campaignCount: Int = 0,
    val formCount: Int = 0,
    val submissionCount: Int = 0,
)

data class DomainDashboardUiState(
    val isLoading: Boolean = true,
    val isDashboardLoading: Boolean = true,
    val activeCampaigns: Int = 0,
    val totalSubmissions: Int = 0,
    val completionRate: Int = 0,
    val totalCampaigns: Int = 0,
    val formTemplates: List<FormTemplateSummaryDto> = emptyList(),
    val subDomains: List<SubDomainUi> = emptyList(),
    val defaultDashboardId: String? = null,
    val error: String? = null,
)

@HiltViewModel
class DomainDashboardViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val campaignDao: CampaignDao,
    private val campaignApi: CampaignApi,
    private val dashboardRepository: DashboardMobileRepository,
) : ViewModel() {

    val domainKey: String = savedStateHandle.get<String>("domainKey") ?: ""
    private val backendDomain: String = RoleConfig.mobileToBackendKey(domainKey)

    /** Optional sub-domain code (null = domain level, non-null = sub-domain level) */
    val subDomainCode: String? = savedStateHandle.get<String>("subDomainCode")
    val subDomainLabel: String? = savedStateHandle.get<String>("subDomainLabel")

    val config: DomainDashboardConfig = DomainDashboards.configFor(domainKey)

    val allCampaigns: StateFlow<List<Campaign>> = campaignRepository
        .getAllCampaignsByDomain(domainKey)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _dashboardWidgets = MutableStateFlow<List<DashboardWidgetEntity>>(emptyList())
    val dashboardWidgets: StateFlow<List<DashboardWidgetEntity>> = _dashboardWidgets.asStateFlow()

    private val _uiState = MutableStateFlow(DomainDashboardUiState())
    val uiState: StateFlow<DomainDashboardUiState> = _uiState.asStateFlow()

    init { loadAll() }

    fun refresh() { loadAll() }

    private fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, isDashboardLoading = true, error = null)
            loadDashboard()
            if (subDomainCode == null) loadSubDomains()
            loadCampaigns()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadDashboard() {
        try {
            dashboardRepository.refreshDashboards()
            val all = dashboardRepository.observeAll()
                .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList()).value

            // Find dashboard for sub-domain or domain
            val dashboard = if (subDomainCode != null) {
                all.find { it.subDomainCode == subDomainCode }
                    ?: all.find { it.domainCode == backendDomain }
            } else {
                all.find { it.domainCode == backendDomain }
            } ?: all.find { it.isDefault } ?: all.firstOrNull()

            if (dashboard != null) {
                _uiState.value = _uiState.value.copy(defaultDashboardId = dashboard.id)
                val result = dashboardRepository.renderAndCache(dashboard.id)
                if (result.isSuccess) {
                    _dashboardWidgets.value = (result.getOrNull() ?: emptyList())
                        .sortedWith(compareBy({ it.gridY }, { it.gridX }))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Dashboard: ${e.message}")
        }
        _uiState.value = _uiState.value.copy(isDashboardLoading = false)
    }

    private suspend fun loadSubDomains() {
        for (code in listOf(backendDomain, domainKey).distinct()) {
            val dtos = campaignApi.getSubDomains(code)
            if (dtos.isNotEmpty()) {
                val items = dtos.filter { it.active }.sortedBy { it.displayOrder }.map { dto ->
                    SubDomainUi(
                        id = dto.id, code = dto.code,
                        labelEn = dto.labelEn.ifBlank { dto.code },
                        labelFr = dto.labelFr.ifBlank { dto.labelEn.ifBlank { dto.code } },
                    )
                }
                _uiState.value = _uiState.value.copy(subDomains = items)
                Log.d(TAG, "Sub-domains: ${items.size} for code=$code")
                return
            }
        }
    }

    private suspend fun loadCampaigns() {
        // If sub-domain mode, filter by subDomainCode
        val dtos = if (subDomainCode != null) {
            campaignApi.getCampaignsBySubDomain(backendDomain, subDomainCode)
        } else {
            campaignApi.getAllCampaignsByDomain(backendDomain)
        }

        if (dtos.isNotEmpty()) {
            val now = System.currentTimeMillis()
            campaignDao.upsertAll(dtos.map { it.toEntity(now) })
            val active = dtos.count { it.status == "ACTIVE" }
            val totalSubs = dtos.sumOf { it.targetSubmissions ?: 0 }
            _uiState.value = _uiState.value.copy(
                activeCampaigns = active, totalSubmissions = totalSubs,
                completionRate = if (totalSubs > 0) 100 else 0,
                totalCampaigns = dtos.size,
            )
            Log.d(TAG, "Campaigns: ${dtos.size} ($active active) for ${subDomainCode ?: backendDomain}")
        } else {
            Log.d(TAG, "No campaigns for ${subDomainCode ?: backendDomain}")
        }
    }

    companion object {
        private const val TAG = "DomainDashboardVM"
    }
}
