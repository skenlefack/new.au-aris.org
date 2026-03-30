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

data class WaterStressUiState(
    val waterBodyName: String = "",
    val selectedStressLevel: String = "",
    val stressLevelExpanded: Boolean = false,
    val measurementDate: Long? = null,
    val selectedCause: String = "",
    val causeExpanded: Boolean = false,
    val affectedAreaKm2: String = "",
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
class WaterStressViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(WaterStressUiState())
    val uiState: StateFlow<WaterStressUiState> = _uiState.asStateFlow()

    companion object {
        val stressLevels = listOf(
            "Extreme (>80%)",
            "High (40-80%)",
            "Medium (20-40%)",
            "Low (10-20%)",
            "Minimal (<10%)",
        )

        val causes = listOf(
            "Drought",
            "Over-extraction",
            "Pollution",
            "Climate change",
            "Deforestation",
            "Agricultural runoff",
            "Industrial use",
        )
    }

    init {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "water_stress"
        }
    }

    fun updateWaterBodyName(value: String) {
        _uiState.value = _uiState.value.copy(
            waterBodyName = value,
            errors = _uiState.value.errors - "waterBodyName",
        )
    }

    fun selectStressLevel(level: String) {
        _uiState.value = _uiState.value.copy(
            selectedStressLevel = level,
            stressLevelExpanded = false,
            errors = _uiState.value.errors - "stressLevel",
        )
    }

    fun toggleStressLevelDropdown() {
        _uiState.value = _uiState.value.copy(stressLevelExpanded = !_uiState.value.stressLevelExpanded)
    }

    fun setMeasurementDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            measurementDate = dateMillis,
            errors = _uiState.value.errors - "date",
        )
    }

    fun selectCause(cause: String) {
        _uiState.value = _uiState.value.copy(
            selectedCause = cause,
            causeExpanded = false,
        )
    }

    fun toggleCauseDropdown() {
        _uiState.value = _uiState.value.copy(causeExpanded = !_uiState.value.causeExpanded)
    }

    fun updateAffectedAreaKm2(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                affectedAreaKm2 = value,
                errors = _uiState.value.errors - "affectedArea",
            )
        }
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
        if (s.waterBodyName.isEmpty()) errors["waterBodyName"] = "Water body name is required"
        if (s.selectedStressLevel.isEmpty()) errors["stressLevel"] = "Stress level is required"
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
            put("type", "water_stress")
            put("waterBodyName", state.waterBodyName)
            put("stressLevel", state.selectedStressLevel)
            put("measurementDate", state.measurementDate ?: System.currentTimeMillis())
            put("cause", state.selectedCause)
            put("affectedAreaKm2", state.affectedAreaKm2.toDoubleOrNull() ?: 0.0)
            put("notes", state.notes)
        }.toString()
    }
}
