package org.auibar.aris.mobile.ui.campaign

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.api.SubmissionApi
import org.auibar.aris.mobile.data.remote.dto.SubmissionListItemDto
import org.auibar.aris.mobile.data.repository.CampaignRepository
import javax.inject.Inject

data class CampaignSubmissionsUiState(
    val campaignName: String = "",
    val submissions: List<SubmissionListItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val isError: Boolean = false,
    val errorMessage: String? = null,
    val statusFilter: String? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

private const val PAGE_SIZE = 20

@HiltViewModel
class CampaignSubmissionsViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val submissionApi: SubmissionApi,
    private val campaignRepository: CampaignRepository,
) : ViewModel() {

    val campaignId: String = savedStateHandle["campaignId"] ?: ""

    private val _uiState = MutableStateFlow(CampaignSubmissionsUiState())
    val uiState: StateFlow<CampaignSubmissionsUiState> = _uiState.asStateFlow()

    init {
        loadCampaignName()
        loadSubmissions()
    }

    private fun loadCampaignName() {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            if (campaign != null) {
                _uiState.update { it.copy(campaignName = campaign.name) }
            }
        }
    }

    fun loadSubmissions() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, isError = false) }
            try {
                val response = submissionApi.listByCampaign(
                    campaignId = campaignId,
                    status = state.statusFilter,
                    page = state.page,
                    limit = PAGE_SIZE,
                )
                val items = response.data ?: emptyList()
                val total = response.meta?.total ?: items.size
                _uiState.update {
                    it.copy(
                        submissions = items,
                        isLoading = false,
                        total = total,
                        totalPages = maxOf(1, (total + PAGE_SIZE - 1) / PAGE_SIZE),
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, isError = true, errorMessage = e.message)
                }
            }
        }
    }

    fun setStatusFilter(status: String?) {
        _uiState.update { it.copy(statusFilter = status, page = 1) }
        loadSubmissions()
    }

    fun nextPage() {
        val state = _uiState.value
        if (state.page < state.totalPages) {
            _uiState.update { it.copy(page = it.page + 1) }
            loadSubmissions()
        }
    }

    fun previousPage() {
        val state = _uiState.value
        if (state.page > 1) {
            _uiState.update { it.copy(page = it.page - 1) }
            loadSubmissions()
        }
    }

    fun refresh() {
        _uiState.update { it.copy(page = 1) }
        loadSubmissions()
    }
}
