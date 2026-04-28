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
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.remote.dto.CampaignDto
import org.auibar.aris.mobile.data.remote.dto.FormTemplateSummaryDto
import org.auibar.aris.mobile.data.remote.dto.SafeApiResponse
import org.auibar.aris.mobile.data.remote.dto.SubDomainDto
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
    private val dashboardRepository: DashboardMobileRepository,
    private val httpClient: HttpClient,
) : ViewModel() {

    val domainKey: String = savedStateHandle.get<String>("domainKey") ?: ""
    private val backendDomain: String = RoleConfig.mobileToBackendKey(domainKey)

    val config: DomainDashboardConfig = DomainDashboards.configFor(domainKey)

    /** All campaigns for this domain from local Room DB (all statuses). */
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

    fun refresh() { loadAll() }

    private fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, isDashboardLoading = true, error = null)
            loadDashboard()
            loadSubDomains()
            loadCampaignsFromApi()
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
                    _dashboardWidgets.value = (result.getOrNull() ?: emptyList())
                        .sortedWith(compareBy({ it.gridY }, { it.gridX }))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Dashboard load failed: ${e.message}")
        }
        _uiState.value = _uiState.value.copy(isDashboardLoading = false)
    }

    private suspend fun loadSubDomains() {
        try {
            val response = httpClient.get("/api/v1/credential/domains/$backendDomain/sub-domains")
            val statusCode = response.status.value
            if (statusCode !in 200..299) {
                Log.w(TAG, "Sub-domains API returned $statusCode for $backendDomain")
                return
            }
            val body: SafeApiResponse<List<SubDomainDto>> = response.body()
            val dtos = body.data ?: emptyList()
            val subDomainUis = dtos
                .filter { it.active }
                .sortedBy { it.displayOrder }
                .map { dto ->
                    SubDomainUi(
                        id = dto.id,
                        code = dto.code,
                        labelEn = dto.labelEn.ifBlank { dto.code },
                        labelFr = dto.labelFr.ifBlank { dto.labelEn.ifBlank { dto.code } },
                    )
                }
            _uiState.value = _uiState.value.copy(subDomains = subDomainUis)
            Log.d(TAG, "Loaded ${subDomainUis.size} sub-domains for $backendDomain")
        } catch (e: Exception) {
            Log.w(TAG, "Sub-domains failed for $backendDomain: ${e.message}")
        }
    }

    /**
     * Fetch ALL campaigns for this domain from API and save to Room.
     * This ensures Room has ACTIVE + PLANNED + COMPLETED + CANCELLED.
     */
    private suspend fun loadCampaignsFromApi() {
        try {
            val response = httpClient.get("/api/v1/collecte/campaigns") {
                parameter("domain", backendDomain)
                parameter("limit", 200)
            }
            if (response.status.value !in 200..299) {
                val text = response.bodyAsText().take(200)
                Log.w(TAG, "Campaigns API returned ${response.status.value}: $text")
                _uiState.value = _uiState.value.copy(error = "Campaigns: HTTP ${response.status.value}")
                return
            }
            val body: SafeApiResponse<List<CampaignDto>> = response.body()
            val campaignDtos = body.data ?: emptyList()

            // Save ALL campaigns to Room (not just active)
            val now = System.currentTimeMillis()
            val entities = campaignDtos.map { it.toEntity(now) }
            if (entities.isNotEmpty()) {
                campaignDao.upsertAll(entities)
            }

            // Update KPI stats
            val active = campaignDtos.filter { it.status == "ACTIVE" }
            val totalSubs = campaignDtos.sumOf { it.targetSubmissions ?: 0 }
            _uiState.value = _uiState.value.copy(
                activeCampaigns = active.size,
                totalSubmissions = totalSubs,
                completionRate = if (totalSubs > 0) 100 else 0,
                totalCampaigns = campaignDtos.size,
            )
            Log.d(TAG, "Loaded ${campaignDtos.size} campaigns for $backendDomain (${active.size} active)")
        } catch (e: Exception) {
            Log.w(TAG, "Campaigns failed: ${e.message}")
            _uiState.value = _uiState.value.copy(error = e.message)
        }
    }

    private suspend fun loadFormTemplates() {
        try {
            val response = httpClient.get("/api/v1/form-builder/templates") {
                parameter("domain", backendDomain)
                parameter("status", "PUBLISHED")
                parameter("limit", 20)
            }
            if (response.status.value !in 200..299) return
            val body: SafeApiResponse<List<FormTemplateSummaryDto>> = response.body()
            _uiState.value = _uiState.value.copy(formTemplates = body.data ?: emptyList())
        } catch (e: Exception) {
            Log.w(TAG, "Form templates failed: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "DomainDashboardVM"
    }
}
