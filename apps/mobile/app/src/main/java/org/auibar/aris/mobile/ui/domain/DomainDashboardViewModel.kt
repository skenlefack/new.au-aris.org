package org.auibar.aris.mobile.ui.domain

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
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
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.DashboardRepository
import javax.inject.Inject

@HiltViewModel
class DomainDashboardViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val dashboardRepository: DashboardRepository,
) : ViewModel() {

    val domainKey: String = savedStateHandle.get<String>("domainKey") ?: ""

    val config: DomainDashboardConfig = DomainDashboards.configFor(domainKey)

    val campaigns: StateFlow<List<Campaign>> = campaignRepository
        .getActiveCampaignsByDomain(domainKey)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _kpis = MutableStateFlow<List<DomainKpi>>(emptyList())
    val kpis: StateFlow<List<DomainKpi>> = _kpis.asStateFlow()

    init {
        loadKpis()
    }

    private fun loadKpis() {
        viewModelScope.launch {
            val result = dashboardRepository.getDomainKpis(domainKey)
            if (result.isSuccess) {
                val serverKpis = result.getOrDefault(emptyList())
                _kpis.value = mergeKpis(serverKpis, config.kpis)
            }
        }
    }

    private fun mergeKpis(server: List<KpiCard>, fallback: List<DomainKpi>): List<DomainKpi> {
        val iconByLabel = fallback.associateBy({ it.label.lowercase() }, { it.icon })
        return server.map { kpi ->
            DomainKpi(
                label = kpi.label,
                value = formatKpiValue(kpi.value, kpi.unit),
                subtitle = kpi.unit,
                trend = kpi.trend,
                trendValue = "",
                icon = iconByLabel[kpi.label.lowercase()] ?: Icons.Default.Assessment,
            )
        }
    }

    private fun formatKpiValue(value: Double, unit: String): String {
        return when {
            unit == "%" -> "${value.toLong()}%"
            value >= 1_000_000_000 -> "%.1fbn".format(value / 1_000_000_000)
            value >= 1_000_000 -> "%.1fM".format(value / 1_000_000)
            value >= 1_000 -> "%.1fK".format(value / 1_000)
            value == value.toLong().toDouble() -> value.toLong().toString()
            else -> "%.1f".format(value)
        }
    }

    fun refresh() {
        loadKpis()
    }
}
