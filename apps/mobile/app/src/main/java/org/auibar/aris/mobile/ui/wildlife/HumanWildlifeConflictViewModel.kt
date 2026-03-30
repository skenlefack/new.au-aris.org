package org.auibar.aris.mobile.ui.wildlife

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class HwcUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val selectedConflictType: String = "",
    val conflictTypeExpanded: Boolean = false,
    val casualties: String = "",
    val damageEstimate: String = "",
    val selectedMitigation: String = "",
    val mitigationExpanded: Boolean = false,
    val incidentDate: Long? = null,
    val notes: String = "",
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsAccuracy: Float? = null,
    val isCapturingGps: Boolean = false,
    val errors: Map<String, String> = emptyMap(),
    val isSaved: Boolean = false,
    val saveMode: String = "",
)

@HiltViewModel
class HumanWildlifeConflictViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val speciesDao: SpeciesDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(HwcUiState())
    val uiState: StateFlow<HwcUiState> = _uiState.asStateFlow()

    private val _speciesList = MutableStateFlow<List<SpeciesEntity>>(emptyList())
    val speciesList: StateFlow<List<SpeciesEntity>> = _speciesList.asStateFlow()

    val conflictTypes = listOf(
        "Crop raiding", "Livestock predation", "Human injury",
        "Human fatality", "Property damage", "Disease transmission",
    )

    val mitigationMeasures = listOf(
        "Fencing", "Guarding", "Deterrents", "Compensation",
        "Translocation", "Community education", "None",
    )

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getByCategory("wildlife")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "hwc_report"
        }
    }

    fun selectSpecies(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedSpeciesId = id,
            selectedSpeciesName = name,
            speciesExpanded = false,
            errors = _uiState.value.errors - "species",
        )
    }

    fun toggleSpeciesDropdown() {
        _uiState.value = _uiState.value.copy(speciesExpanded = !_uiState.value.speciesExpanded)
    }

    fun selectConflictType(type: String) {
        _uiState.value = _uiState.value.copy(
            selectedConflictType = type,
            conflictTypeExpanded = false,
            errors = _uiState.value.errors - "conflictType",
        )
    }

    fun toggleConflictTypeDropdown() {
        _uiState.value = _uiState.value.copy(
            conflictTypeExpanded = !_uiState.value.conflictTypeExpanded,
        )
    }

    fun updateCasualties(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                casualties = value,
                errors = _uiState.value.errors - "casualties",
            )
        }
    }

    fun updateDamageEstimate(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                damageEstimate = value,
                errors = _uiState.value.errors - "damageEstimate",
            )
        }
    }

    fun selectMitigation(measure: String) {
        _uiState.value = _uiState.value.copy(
            selectedMitigation = measure,
            mitigationExpanded = false,
        )
    }

    fun toggleMitigationDropdown() {
        _uiState.value = _uiState.value.copy(
            mitigationExpanded = !_uiState.value.mitigationExpanded,
        )
    }

    fun setIncidentDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(incidentDate = dateMillis)
    }

    fun updateNotes(value: String) {
        _uiState.value = _uiState.value.copy(notes = value)
    }

    @SuppressLint("MissingPermission")
    fun captureGps() {
        _uiState.value = _uiState.value.copy(isCapturingGps = true)
        viewModelScope.launch {
            try {
                val fusedClient = LocationServices.getFusedLocationProviderClient(context)
                val location: Location? = fusedClient.lastLocation.await()
                _uiState.value = _uiState.value.copy(
                    gpsLat = location?.latitude,
                    gpsLng = location?.longitude,
                    gpsAccuracy = location?.accuracy,
                    isCapturingGps = false,
                )
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(isCapturingGps = false)
            }
        }
    }

    private fun validate(): Map<String, String> {
        val errors = mutableMapOf<String, String>()
        val s = _uiState.value
        if (s.selectedSpeciesId.isEmpty()) errors["species"] = "Species is required"
        if (s.selectedConflictType.isEmpty()) errors["conflictType"] = "Conflict type is required"
        return errors
    }

    fun saveDraft() {
        val data = buildJsonData()
        viewModelScope.launch {
            submissionRepository.saveDraft(
                id = UUID.randomUUID().toString(),
                tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId,
                templateId = resolvedTemplateId,
                data = data,
                gpsLat = _uiState.value.gpsLat,
                gpsLng = _uiState.value.gpsLng,
                gpsAccuracy = _uiState.value.gpsAccuracy,
                domain = "wildlife",
            )
            _uiState.value = _uiState.value.copy(isSaved = true, saveMode = "draft")
        }
    }

    fun submit() {
        val errors = validate()
        if (errors.isNotEmpty()) {
            _uiState.value = _uiState.value.copy(errors = errors)
            return
        }
        val data = buildJsonData()
        viewModelScope.launch {
            submissionRepository.submitForm(
                id = UUID.randomUUID().toString(),
                tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId,
                templateId = resolvedTemplateId,
                data = data,
                gpsLat = _uiState.value.gpsLat,
                gpsLng = _uiState.value.gpsLng,
                gpsAccuracy = _uiState.value.gpsAccuracy,
                domain = "wildlife",
            )
            _uiState.value = _uiState.value.copy(isSaved = true, saveMode = "submit")
        }
    }

    /** Kept for backward compatibility */
    fun save() = saveDraft()

    private fun buildJsonData(): String {
        val state = _uiState.value
        return buildJsonObject {
            put("type", "hwc_report")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("conflictType", state.selectedConflictType)
            put("casualties", state.casualties.toLongOrNull() ?: 0L)
            put("damageEstimateUsd", state.damageEstimate.toDoubleOrNull() ?: 0.0)
            put("mitigation", state.selectedMitigation)
            put("incidentDate", state.incidentDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
