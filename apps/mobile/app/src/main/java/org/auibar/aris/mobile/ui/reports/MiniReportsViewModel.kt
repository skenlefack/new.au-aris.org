package org.auibar.aris.mobile.ui.reports

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import org.auibar.aris.mobile.ui.theme.SyncConflict
import org.auibar.aris.mobile.ui.theme.SyncFailed
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess
import org.auibar.aris.mobile.ui.theme.DomainAnimalHealth
import org.auibar.aris.mobile.ui.theme.DomainLivestock
import org.auibar.aris.mobile.ui.theme.DomainFisheries
import org.auibar.aris.mobile.ui.theme.DomainTrade
import org.auibar.aris.mobile.ui.theme.DomainWildlife
import org.auibar.aris.mobile.ui.theme.DomainApiculture
import org.auibar.aris.mobile.ui.theme.DomainGovernance
import org.auibar.aris.mobile.ui.theme.DomainClimate
import org.auibar.aris.mobile.ui.theme.DomainKnowledge
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.ui.charts.BarChartItem
import org.auibar.aris.mobile.ui.charts.LineChartPoint
import org.auibar.aris.mobile.ui.charts.PieChartSlice
import org.auibar.aris.mobile.util.TokenManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class StatusCount(val status: String, val count: Int)
data class DomainCount(val domain: String, val count: Int)
data class CampaignProgressItem(val campaignId: String, val campaignName: String, val submissionCount: Int)

data class ReportsUiState(
    val statusCounts: List<StatusCount> = emptyList(),
    val domainCounts: List<DomainCount> = emptyList(),
    val campaignProgress: List<CampaignProgressItem> = emptyList(),
    val totalSynced: Int = 0,
    val totalPending: Int = 0,
    val totalFailed: Int = 0,
    val totalSubmissions: Int = 0,
    val lastSyncAt: Long? = null,
    val statusPieData: List<PieChartSlice> = emptyList(),
    val domainBarData: List<BarChartItem> = emptyList(),
    val syncHistoryData: List<LineChartPoint> = emptyList(),
    val campaignProgressData: List<BarChartItem> = emptyList(),
)

@HiltViewModel
class MiniReportsViewModel @Inject constructor(
    submissionDao: SubmissionDao,
    campaignDao: CampaignDao,
    tokenManager: TokenManager,
) : ViewModel() {

    val uiState = combine(
        submissionDao.getAll(),
        campaignDao.getActiveCampaigns(),
    ) { submissions, campaigns ->
        val statusCounts = submissions.groupBy { it.syncStatus }
            .map { (status, list) -> StatusCount(status, list.size) }
            .sortedByDescending { it.count }

        val domainMap = mutableMapOf<String, Int>()
        for (sub in submissions) {
            val campaign = campaigns.find { it.id == sub.campaignId }
            val domain = campaign?.domain ?: "Unknown"
            domainMap[domain] = (domainMap[domain] ?: 0) + 1
        }
        val domainCounts = domainMap.map { DomainCount(it.key, it.value) }
            .sortedByDescending { it.count }

        val campaignProgress = campaigns.map { campaign ->
            val count = submissions.count { it.campaignId == campaign.id }
            CampaignProgressItem(campaign.id, campaign.name, count)
        }.filter { it.submissionCount > 0 }
            .sortedByDescending { it.submissionCount }

        val totalSynced = submissions.count { it.syncStatus == "SYNCED" }
        val totalPending = submissions.count { it.syncStatus == "PENDING" || it.syncStatus == "DRAFT" }
        val totalFailed = submissions.count { it.syncStatus == "FAILED" }

        // Chart data: Pie chart slices for status
        val statusPieData = statusCounts.map { sc ->
            PieChartSlice(
                label = sc.status,
                value = sc.count.toFloat(),
                color = statusChartColor(sc.status),
            )
        }

        // Chart data: Horizontal bar items for domain
        val domainColors = listOf(
            DomainAnimalHealth, DomainLivestock, DomainFisheries,
            DomainTrade, DomainWildlife, DomainApiculture,
            DomainGovernance, DomainClimate, DomainKnowledge,
        )
        val domainBarData = domainCounts.mapIndexed { index, dc ->
            BarChartItem(
                label = dc.domain,
                value = dc.count.toFloat(),
                color = domainColors[index % domainColors.size],
            )
        }

        // Chart data: Line chart for sync history (submissions grouped by day)
        val dateFormat = SimpleDateFormat("dd MMM", Locale.getDefault())
        val dayFormat = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        val syncHistoryData = submissions
            .sortedBy { it.offlineCreatedAt }
            .groupBy { dayFormat.format(Date(it.offlineCreatedAt)) }
            .entries
            .toList()
            .takeLast(7)
            .map { (dayKey, subs) ->
                val displayDate = dateFormat.format(
                    dayFormat.parse(dayKey) ?: Date(),
                )
                LineChartPoint(label = displayDate, value = subs.size.toFloat())
            }

        // Chart data: Horizontal bar items for campaign progress
        val campaignProgressData = campaignProgress.map { cp ->
            BarChartItem(
                label = cp.campaignName,
                value = cp.submissionCount.toFloat(),
                color = DomainTrade,
            )
        }

        ReportsUiState(
            statusCounts = statusCounts,
            domainCounts = domainCounts,
            campaignProgress = campaignProgress,
            totalSynced = totalSynced,
            totalPending = totalPending,
            totalFailed = totalFailed,
            totalSubmissions = submissions.size,
            lastSyncAt = tokenManager.lastSyncAt,
            statusPieData = statusPieData,
            domainBarData = domainBarData,
            syncHistoryData = syncHistoryData,
            campaignProgressData = campaignProgressData,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = ReportsUiState(),
    )
}

private fun statusChartColor(status: String): Color = when (status) {
    "SYNCED" -> SyncSuccess
    "PENDING" -> SyncPending
    "FAILED" -> SyncFailed
    "DRAFT" -> Color(0xFF9E9E9E)
    "CONFLICT" -> SyncConflict
    else -> Color(0xFF9E9E9E)
}
