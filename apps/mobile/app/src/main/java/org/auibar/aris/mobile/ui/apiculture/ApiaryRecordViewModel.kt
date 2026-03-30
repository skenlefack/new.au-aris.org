package org.auibar.aris.mobile.ui.apiculture

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

data class ApiaryUiState(
    val colonyCount: String = "",
    val selectedHiveType: String = "",
    val hiveTypeExpanded: Boolean = false,
    val honeyProductionKg: String = "",
    val selectedHealthStatus: String = "",
    val healthStatusExpanded: Boolean = false,
    val selectedBeeSpecies: String = "",
    val beeSpeciesExpanded: Boolean = false,
    val inspectionDate: Long? = null,
    val notes: String = "",
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsAccuracy: Float? = null,
    val isCapturingGps: Boolean = false,
    // Validation
    val errors: Map<String, String> = emptyMap(),
    val isSaved: Boolean = false,
    val saveMode: String = "",
)

@HiltViewModel
class ApiaryRecordViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    companion object {
        val hiveTypes = listOf(
            "Langstroth", "Top-bar", "Traditional log", "Warre", "Flow hive", "Other",
        )
        val beeSpecies = listOf(
            "Apis mellifera", "Apis mellifera scutellata", "Apis mellifera adansonii",
            "Apis mellifera capensis", "Meliponini (stingless)",
        )
        val healthStatuses = listOf(
            "Healthy", "Weak", "Diseased", "Collapsed", "Absconded",
        )
    }

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(ApiaryUiState())
    val uiState: StateFlow<ApiaryUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "apiary_record"
        }
    }

    fun updateColonyCount(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                colonyCount = value,
                errors = _uiState.value.errors - "colonyCount",
            )
        }
    }

    fun selectHiveType(type: String) {
        _uiState.value = _uiState.value.copy(
            selectedHiveType = type,
            hiveTypeExpanded = false,
            errors = _uiState.value.errors - "hiveType",
        )
    }

    fun toggleHiveTypeDropdown() {
        _uiState.value = _uiState.value.copy(hiveTypeExpanded = !_uiState.value.hiveTypeExpanded)
    }

    fun updateHoneyProductionKg(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                honeyProductionKg = value,
                errors = _uiState.value.errors - "honeyProductionKg",
            )
        }
    }

    fun selectHealthStatus(status: String) {
        _uiState.value = _uiState.value.copy(
            selectedHealthStatus = status,
            healthStatusExpanded = false,
        )
    }

    fun toggleHealthStatusDropdown() {
        _uiState.value = _uiState.value.copy(healthStatusExpanded = !_uiState.value.healthStatusExpanded)
    }

    fun selectBeeSpecies(species: String) {
        _uiState.value = _uiState.value.copy(
            selectedBeeSpecies = species,
            beeSpeciesExpanded = false,
        )
    }

    fun toggleBeeSpeciesDropdown() {
        _uiState.value = _uiState.value.copy(beeSpeciesExpanded = !_uiState.value.beeSpeciesExpanded)
    }

    fun setInspectionDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            inspectionDate = dateMillis,
            errors = _uiState.value.errors - "inspectionDate",
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
        if (s.colonyCount.isEmpty()) errors["colonyCount"] = "Colony count is required"
        else if ((s.colonyCount.toLongOrNull() ?: 0) <= 0) errors["colonyCount"] = "Must be positive"
        if (s.selectedHiveType.isEmpty()) errors["hiveType"] = "Hive type is required"
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
            put("type", "apiary_record")
            put("domain", "apiculture")
            put("colonyCount", state.colonyCount.toLongOrNull() ?: 0L)
            put("hiveType", state.selectedHiveType)
            put("honeyProductionKg", state.honeyProductionKg.toDoubleOrNull() ?: 0.0)
            put("healthStatus", state.selectedHealthStatus)
            put("beeSpecies", state.selectedBeeSpecies)
            put("inspectionDate", state.inspectionDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
