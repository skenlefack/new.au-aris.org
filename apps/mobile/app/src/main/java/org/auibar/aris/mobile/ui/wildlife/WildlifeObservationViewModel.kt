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

data class WildlifeObservationUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val count: String = "",
    val selectedObservationMethod: String = "",
    val observationMethodExpanded: Boolean = false,
    val selectedHabitatType: String = "",
    val habitatTypeExpanded: Boolean = false,
    val protectedAreaName: String = "",
    val selectedThreatLevel: String = "",
    val threatLevelExpanded: Boolean = false,
    val observationDate: Long? = null,
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
class WildlifeObservationViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val speciesDao: SpeciesDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(WildlifeObservationUiState())
    val uiState: StateFlow<WildlifeObservationUiState> = _uiState.asStateFlow()

    private val _speciesList = MutableStateFlow<List<SpeciesEntity>>(emptyList())
    val speciesList: StateFlow<List<SpeciesEntity>> = _speciesList.asStateFlow()

    val observationMethods = listOf(
        "Direct sighting", "Camera trap", "Aerial survey",
        "Track/Sign", "Acoustic", "DNA sampling",
    )

    val habitatTypes = listOf(
        "Forest", "Savanna", "Grassland", "Wetland",
        "Desert", "Coastal", "Marine", "Montane",
    )

    val threatLevels = listOf(
        "Critical", "High", "Medium", "Low", "Not threatened",
    )

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getByCategory("wildlife")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "wildlife_observation"
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

    fun updateCount(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                count = value,
                errors = _uiState.value.errors - "count",
            )
        }
    }

    fun selectObservationMethod(method: String) {
        _uiState.value = _uiState.value.copy(
            selectedObservationMethod = method,
            observationMethodExpanded = false,
            errors = _uiState.value.errors - "observationMethod",
        )
    }

    fun toggleObservationMethodDropdown() {
        _uiState.value = _uiState.value.copy(
            observationMethodExpanded = !_uiState.value.observationMethodExpanded,
        )
    }

    fun selectHabitatType(habitat: String) {
        _uiState.value = _uiState.value.copy(
            selectedHabitatType = habitat,
            habitatTypeExpanded = false,
        )
    }

    fun toggleHabitatTypeDropdown() {
        _uiState.value = _uiState.value.copy(
            habitatTypeExpanded = !_uiState.value.habitatTypeExpanded,
        )
    }

    fun updateProtectedAreaName(value: String) {
        _uiState.value = _uiState.value.copy(protectedAreaName = value)
    }

    fun selectThreatLevel(level: String) {
        _uiState.value = _uiState.value.copy(
            selectedThreatLevel = level,
            threatLevelExpanded = false,
        )
    }

    fun toggleThreatLevelDropdown() {
        _uiState.value = _uiState.value.copy(
            threatLevelExpanded = !_uiState.value.threatLevelExpanded,
        )
    }

    fun setObservationDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(observationDate = dateMillis)
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
        if (s.count.isEmpty()) errors["count"] = "Count is required"
        else if ((s.count.toLongOrNull() ?: 0) <= 0) errors["count"] = "Must be positive"
        if (s.selectedObservationMethod.isEmpty()) errors["observationMethod"] = "Observation method is required"
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
            put("type", "wildlife_observation")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("count", state.count.toLongOrNull() ?: 0L)
            put("observationMethod", state.selectedObservationMethod)
            put("habitatType", state.selectedHabitatType)
            put("protectedAreaName", state.protectedAreaName)
            put("threatLevel", state.selectedThreatLevel)
            put("observationDate", state.observationDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
