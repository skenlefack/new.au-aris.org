package org.auibar.aris.mobile.ui.campaign

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.cache.CampaignRefresher
import org.auibar.aris.mobile.data.repository.Campaign
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.data.repository.SyncRepository
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

data class CampaignListUiState(
    val isRefreshing: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class CampaignListViewModel @Inject constructor(
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val syncRepository: SyncRepository,
    private val campaignRefresher: CampaignRefresher,
    private val tokenManager: TokenManager,
) : ViewModel() {

    val campaigns: StateFlow<List<Campaign>> = campaignRepository
        .getActiveCampaigns()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val pendingCount: StateFlow<Int> = submissionRepository
        .getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _uiState = MutableStateFlow(CampaignListUiState())
    val uiState: StateFlow<CampaignListUiState> = _uiState.asStateFlow()

    val lastSyncAt: Long?
        get() = tokenManager.lastSyncAt

    init {
        viewModelScope.launch {
            campaignRefresher.refreshIfNeeded()
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true, error = null)
            campaignRefresher.forceRefresh()
            val result = campaignRepository.refreshCampaigns()
            _uiState.value = _uiState.value.copy(
                isRefreshing = false,
                error = result.exceptionOrNull()?.message,
            )
        }
    }

    fun sync() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            syncRepository.performSync()
            campaignRepository.refreshCampaigns()
            _uiState.value = _uiState.value.copy(isRefreshing = false)
        }
    }
}
