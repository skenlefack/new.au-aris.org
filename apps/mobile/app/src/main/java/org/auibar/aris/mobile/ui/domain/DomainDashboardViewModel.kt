package org.auibar.aris.mobile.ui.domain

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
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
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.SubDomainDto
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardMobileRepository
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
    private val campaignApi: CampaignApi,
    private val dashboardRepository: DashboardMobileRepository,
    private val dashboardWidgetDao: DashboardWidgetDao,
    private val httpClient: HttpClient,
) : ViewModel() {

    val domainKey: String = savedStateHandle.get<String>("domainKey") ?: ""
    private val backendDomain: String = RoleConfig.mobileToBackendKey(domainKey)

    val config: DomainDashboardConfig = DomainDashboards.configFor(domainKey)

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

            loadDashboard()
            loadSubDomains()
            loadCampaigns()
            loadFormTemplates()

            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadDashboard() {
        try {
            dashboardRepository.refreshDashboards()
            val allDashboards = dashboardRepository.observeAll()
                .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList()).value
            val domainDashboard = allDashboards.find { it.domainCode == backendDomain }
                ?: allDashboards.find { it.isDefault }
                ?: allDashboards.firstOrNull()
            if (domainDashboard != null) {
                _uiState.value = _uiState.value.copy(defaultDashboardId = domainDashboard.id)
                val result = dashboardRepository.renderAndCache(domainDashboard.id)
                if (result.isSuccess) {
                    _dashboardWidgets.value = (result.getOrNull() ?: emptyList()).sortedWith(compareBy({ it.gridY }, { it.gridX }))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load dashboard: ${e.message}")
        }
        _uiState.value = _uiState.value.copy(isDashboardLoading = false)
    }

    private suspend fun loadSubDomains() {
        try {
            val response: SafeApiResponse<List<SubDomainDto>> =
                httpClient.get("/api/v1/credential/domains/$backendDomain/sub-domains").body()
            val dtos = response.data ?: emptyList()
            val subDomainUis = dtos.filter { it.active }.sortedBy { it.displayOrder }.map { dto ->
                SubDomainUi(
                    id = dto.id,
                    code = dto.code,
                    labelEn = dto.labelEn.ifBlank { dto.code },
                    labelFr = dto.labelFr.ifBlank { dto.labelEn.ifBlank { dto.code } },
                )
            }
            _uiState.value = _uiState.value.copy(subDomains = subDomainUis)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load sub-domains: ${e.message}")
            // Sub-domains are optional — no error shown
        }
    }

    private suspend fun loadCampaigns() {
        try {
            val response: SafeApiResponse<List<org.auibar.aris.mobile.data.remote.dto.CampaignDto>> =
                httpClient.get("/api/v1/collecte/campaigns") {
                    parameter("domain", backendDomain)
                    parameter("limit", 100)
                }.body()
            val allCampaigns = response.data ?: emptyList()
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
            val response: SafeApiResponse<List<FormTemplateSummaryDto>> =
                httpClient.get("/api/v1/form-builder/templates") {
                    parameter("domain", backendDomain)
                    parameter("status", "PUBLISHED")
                    parameter("limit", 20)
                }.body()
            _uiState.value = _uiState.value.copy(formTemplates = response.data ?: emptyList())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load form templates: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "DomainDashboardVM"
    }
}
