package org.auibar.aris.mobile.ui.campaign

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
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import javax.inject.Inject

data class CampaignDetailUiState(
    val campaignName: String = "",
    val domain: String = "",
    val startDate: Long = 0,
    val endDate: Long = 0,
)

@HiltViewModel
class CampaignDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""

    private val _uiState = MutableStateFlow(CampaignDetailUiState())
    val uiState: StateFlow<CampaignDetailUiState> = _uiState.asStateFlow()

    val submissions: StateFlow<List<Submission>> = submissionRepository
        .getByCampaign(campaignId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val submissionCount: StateFlow<Int> = submissionRepository
        .getCountByCampaign(campaignId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    init {
        loadCampaign()
    }

    private fun loadCampaign() {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId) ?: return@launch
            _uiState.value = CampaignDetailUiState(
                campaignName = campaign.name,
                domain = campaign.domain,
                startDate = campaign.startDate,
                endDate = campaign.endDate,
            )
        }
    }
}
