package org.auibar.aris.mobile.ui.climate

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
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class RangelandUiState(
    val areaName: String = "",
    val conditionScore: String = "",
    val vegetationCover: String = "",
    val selectedDegradationLevel: String = "",
    val degradationLevelExpanded: Boolean = false,
    val carryingCapacity: String = "",
    val assessmentDate: Long? = null,
    val notes: String = "",
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsAccuracy: Float? = null,
    val isCapturingGps: Boolean = false,
    // Validation
    val errors: Map<String, String> = emptyMap(),
    val isSaved: Boolean = false,
    val saveMode: String = "", // "draft" or "submit"
)

@HiltViewModel
class RangelandViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(RangelandUiState())
    val uiState: StateFlow<RangelandUiState> = _uiState.asStateFlow()

    companion object {
        val degradationLevels = listOf(
            "Severe",
            "High",
            "Moderate",
            "Light",
            "None",
        )
    }

    init {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "rangeland"
        }
    }

    fun updateAreaName(value: String) {
        _uiState.value = _uiState.value.copy(
            areaName = value,
            errors = _uiState.value.errors - "areaName",
        )
    }

    fun updateConditionScore(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                conditionScore = value,
                errors = _uiState.value.errors - "conditionScore",
            )
        }
    }

    fun updateVegetationCover(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                vegetationCover = value,
                errors = _uiState.value.errors - "vegetationCover",
            )
        }
    }

    fun selectDegradationLevel(level: String) {
        _uiState.value = _uiState.value.copy(
            selectedDegradationLevel = level,
            degradationLevelExpanded = false,
        )
    }

    fun toggleDegradationLevelDropdown() {
        _uiState.value = _uiState.value.copy(degradationLevelExpanded = !_uiState.value.degradationLevelExpanded)
    }

    fun updateCarryingCapacity(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                carryingCapacity = value,
                errors = _uiState.value.errors - "carryingCapacity",
            )
        }
    }

    fun setAssessmentDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            assessmentDate = dateMillis,
            errors = _uiState.value.errors - "date",
        )
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
        if (s.areaName.isEmpty()) errors["areaName"] = "Area name is required"
        if (s.conditionScore.isNotEmpty()) {
            val score = s.conditionScore.toIntOrNull()
            if (score == null || score < 1 || score > 5) errors["conditionScore"] = "Must be between 1 and 5"
        }
        if (s.vegetationCover.isNotEmpty()) {
            val cover = s.vegetationCover.toIntOrNull()
            if (cover == null || cover < 0 || cover > 100) errors["vegetationCover"] = "Must be between 0 and 100"
        }
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
            )
            _uiState.value = _uiState.value.copy(isSaved = true, saveMode = "submit")
        }
    }

    /** Kept for backward compatibility */
    fun save() = saveDraft()

    private fun buildJsonData(): String {
        val state = _uiState.value
        return buildJsonObject {
            put("domain", "climate")
            put("type", "rangeland")
            put("areaName", state.areaName)
            put("conditionScore", state.conditionScore.toIntOrNull() ?: 0)
            put("vegetationCover", state.vegetationCover.toIntOrNull() ?: 0)
            put("degradationLevel", state.selectedDegradationLevel)
            put("carryingCapacity", state.carryingCapacity.toDoubleOrNull() ?: 0.0)
            put("assessmentDate", state.assessmentDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
