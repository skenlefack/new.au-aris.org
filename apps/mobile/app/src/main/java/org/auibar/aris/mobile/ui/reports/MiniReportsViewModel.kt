package org.auibar.aris.mobile.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.util.TokenManager
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

        ReportsUiState(
            statusCounts = statusCounts,
            domainCounts = domainCounts,
            campaignProgress = campaignProgress,
            totalSynced = totalSynced,
            totalPending = totalPending,
            totalFailed = totalFailed,
            totalSubmissions = submissions.size,
            lastSyncAt = tokenManager.lastSyncAt,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = ReportsUiState(),
    )
}
