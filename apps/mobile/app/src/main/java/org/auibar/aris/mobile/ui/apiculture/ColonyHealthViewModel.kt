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

data class ColonyHealthUiState(
    val colonyId: String = "",
    val selectedQueenStatus: String = "",
    val queenStatusExpanded: Boolean = false,
    val selectedPestDisease: String = "",
    val pestDiseaseExpanded: Boolean = false,
    val selectedTreatment: String = "",
    val treatmentExpanded: Boolean = false,
    val losses: String = "",
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
class ColonyHealthViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    companion object {
        val queenStatuses = listOf(
            "Present - laying", "Present - not laying", "Virgin", "Missing", "Superseded",
        )
        val pestsAndDiseases = listOf(
            "Varroa mite", "American foulbrood", "European foulbrood", "Nosema",
            "Small hive beetle", "Wax moth", "Chalkbrood", "None detected",
        )
        val treatments = listOf(
            "Oxalic acid", "Formic acid", "Amitraz", "Fluvalinate", "Thymol",
            "Antibiotics", "Biological control", "No treatment",
        )
    }

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(ColonyHealthUiState())
    val uiState: StateFlow<ColonyHealthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "colony_health"
        }
    }

    fun updateColonyId(value: String) {
        _uiState.value = _uiState.value.copy(
            colonyId = value,
            errors = _uiState.value.errors - "colonyId",
        )
    }

    fun selectQueenStatus(status: String) {
        _uiState.value = _uiState.value.copy(
            selectedQueenStatus = status,
            queenStatusExpanded = false,
            errors = _uiState.value.errors - "queenStatus",
        )
    }

    fun toggleQueenStatusDropdown() {
        _uiState.value = _uiState.value.copy(queenStatusExpanded = !_uiState.value.queenStatusExpanded)
    }

    fun selectPestDisease(pest: String) {
        _uiState.value = _uiState.value.copy(
            selectedPestDisease = pest,
            pestDiseaseExpanded = false,
        )
    }

    fun togglePestDiseaseDropdown() {
        _uiState.value = _uiState.value.copy(pestDiseaseExpanded = !_uiState.value.pestDiseaseExpanded)
    }

    fun selectTreatment(treatment: String) {
        _uiState.value = _uiState.value.copy(
            selectedTreatment = treatment,
            treatmentExpanded = false,
        )
    }

    fun toggleTreatmentDropdown() {
        _uiState.value = _uiState.value.copy(treatmentExpanded = !_uiState.value.treatmentExpanded)
    }

    fun updateLosses(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                losses = value,
                errors = _uiState.value.errors - "losses",
            )
        }
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
        if (s.colonyId.isEmpty()) errors["colonyId"] = "Colony ID is required"
        if (s.selectedQueenStatus.isEmpty()) errors["queenStatus"] = "Queen status is required"
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
            put("type", "colony_health")
            put("domain", "apiculture")
            put("colonyId", state.colonyId)
            put("queenStatus", state.selectedQueenStatus)
            put("pestDisease", state.selectedPestDisease)
            put("treatment", state.selectedTreatment)
            put("losses", state.losses.toLongOrNull() ?: 0L)
            put("inspectionDate", state.inspectionDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
