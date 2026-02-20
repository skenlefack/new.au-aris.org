package org.auibar.aris.mobile.ui.livestock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
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
    private val speciesDao: SpeciesDao,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CensusUiState())
    val uiState: StateFlow<CensusUiState> = _uiState.asStateFlow()

    val speciesList = speciesDao.getAll()

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

    fun save(campaignId: String) {
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
                templateId = "livestock_census",
                data = data,
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
            )
        }
    }
}
