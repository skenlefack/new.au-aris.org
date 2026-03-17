package org.auibar.aris.mobile.ui.livestock

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class CensusUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val populationCount: String = "",
    val selectedMethodology: String = "",
    val methodologyExpanded: Boolean = false,
)

@HiltViewModel
class LivestockCensusViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val speciesDao: SpeciesDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(CensusUiState())
    val uiState: StateFlow<CensusUiState> = _uiState.asStateFlow()

    private val _speciesList = MutableStateFlow<List<SpeciesEntity>>(emptyList())
    val speciesList: StateFlow<List<SpeciesEntity>> = _speciesList.asStateFlow()

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getAll()
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "livestock_census"
        }
    }

    fun selectSpecies(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedSpeciesId = id,
            selectedSpeciesName = name,
            speciesExpanded = false,
        )
    }

    fun toggleSpeciesDropdown() {
        _uiState.value = _uiState.value.copy(speciesExpanded = !_uiState.value.speciesExpanded)
    }

    fun updatePopulationCount(value: String) {
        // Only allow digits
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(populationCount = value)
        }
    }

    fun selectMethodology(method: String) {
        _uiState.value = _uiState.value.copy(
            selectedMethodology = method,
            methodologyExpanded = false,
        )
    }

    fun toggleMethodologyDropdown() {
        _uiState.value = _uiState.value.copy(methodologyExpanded = !_uiState.value.methodologyExpanded)
    }

    fun save() {
        val state = _uiState.value
        val data = buildJsonObject {
            put("type", "livestock_census")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("populationCount", state.populationCount.toLongOrNull() ?: 0L)
            put("methodology", state.selectedMethodology)
        }.toString()

        viewModelScope.launch {
            submissionRepository.saveDraft(
                id = UUID.randomUUID().toString(),
                tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId,
                templateId = resolvedTemplateId,
                data = data,
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
            )
        }
    }
}
