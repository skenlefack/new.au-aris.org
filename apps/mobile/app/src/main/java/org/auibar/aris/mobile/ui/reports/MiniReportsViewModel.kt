package org.auibar.aris.mobile.ui.reports

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
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
            Color(0xFF1976D2), Color(0xFF388E3C), Color(0xFFF57C00),
            Color(0xFF7B1FA2), Color(0xFF0097A7), Color(0xFFD32F2F),
            Color(0xFF455A64), Color(0xFF689F38), Color(0xFFE64A19),
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
                color = Color(0xFF1976D2),
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
    "SYNCED" -> Color(0xFF4CAF50)
    "PENDING" -> Color(0xFF2196F3)
    "FAILED" -> Color(0xFFF44336)
    "DRAFT" -> Color(0xFF9E9E9E)
    "CONFLICT" -> Color(0xFFFF9800)
    else -> Color(0xFF9E9E9E)
}
