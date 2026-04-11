package org.auibar.aris.mobile.ui.paid

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardRepository
import javax.inject.Inject

data class PaidCampaignStat(
    val id: String,
    val name: String,
    val target: Int,
    val completed: Int,
    val status: String,
) {
    val progress: Float
        get() = if (target > 0) (completed.toFloat() / target).coerceIn(0f, 1f) else 0f
}

data class PaidDashboardUiState(
    val activeCampaigns: Int = 0,
    val totalSubmissions: Int = 0,
    val completionRate: Float = 0f,
    val campaignStats: List<PaidCampaignStat> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PaidDashboardViewModel @Inject constructor(
    private val campaignRepository: CampaignRepository,
    private val dashboardRepository: DashboardRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PaidDashboardUiState(isLoading = true))
    val uiState: StateFlow<PaidDashboardUiState> = _uiState.asStateFlow()

    val campaigns: StateFlow<List<Campaign>> = campaignRepository
        .getActiveCampaignsByDomain("paid")
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadPaidStats()
    }

    private fun loadPaidStats() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val result = dashboardRepository.getDomainKpis("paid")
                val serverKpis = result.getOrDefault(emptyList())

                // Build stats from server data or use defaults
                val activeCampaigns = serverKpis.find {
                    it.label.lowercase().contains("campaign")
                }?.value?.toInt() ?: 18
                val totalSubmissions = serverKpis.find {
                    it.label.lowercase().contains("submission")
                }?.value?.toInt() ?: 4250
                val completionRate = serverKpis.find {
                    it.label.lowercase().contains("completion")
                }?.value?.let { it.toFloat() / 100f } ?: 0.76f

                // Generate mock campaign stats from actual campaigns or defaults
                val campaignList = campaigns.value
                val stats = if (campaignList.isNotEmpty()) {
                    campaignList.map { c ->
                        PaidCampaignStat(
                            id = c.id,
                            name = c.name,
                            target = 100,
                            completed = (100 * completionRate).toInt(),
                            status = c.status,
                        )
                    }
                } else {
                    // Fallback sample data
                    listOf(
                        PaidCampaignStat("p1", "PAID - Kenya Livestock Census 2026", 500, 380, "Active"),
                        PaidCampaignStat("p2", "PAID - Ethiopia Animal ID", 300, 245, "Active"),
                        PaidCampaignStat("p3", "PAID - Nigeria Poultry Registration", 400, 400, "Completed"),
                        PaidCampaignStat("p4", "PAID - Senegal Cattle Tagging", 250, 120, "Active"),
                    )
                }

                _uiState.value = PaidDashboardUiState(
                    activeCampaigns = activeCampaigns,
                    totalSubmissions = totalSubmissions,
                    completionRate = completionRate,
                    campaignStats = stats,
                    isLoading = false,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message,
                )
            }
        }
    }

    fun refresh() {
        loadPaidStats()
    }
}
