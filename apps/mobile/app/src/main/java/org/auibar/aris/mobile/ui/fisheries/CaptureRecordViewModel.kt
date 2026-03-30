package org.auibar.aris.mobile.ui.fisheries

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

data class CaptureUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val selectedFaoArea: String = "",
    val faoAreaExpanded: Boolean = false,
    val quantityKg: String = "",
    val vesselName: String = "",
    val selectedGearType: String = "",
    val gearTypeExpanded: Boolean = false,
    val landingSite: String = "",
    val captureDate: Long? = null,
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
class CaptureRecordViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val speciesDao: SpeciesDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(CaptureUiState())
    val uiState: StateFlow<CaptureUiState> = _uiState.asStateFlow()

    private val _speciesList = MutableStateFlow<List<SpeciesEntity>>(emptyList())
    val speciesList: StateFlow<List<SpeciesEntity>> = _speciesList.asStateFlow()

    val faoAreas = listOf(
        "Area 34 - Eastern Central Atlantic",
        "Area 47 - Southeast Atlantic",
        "Area 51 - Western Indian Ocean",
        "Area 57 - Eastern Indian Ocean",
        "Area 01 - Africa Inland Waters",
    )

    val gearTypes = listOf(
        "Trawl", "Purse seine", "Gillnet", "Longline",
        "Hook and line", "Trap/Pot", "Cast net", "Beach seine",
    )

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getByCategory("aquatic")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "capture_record"
        }
    }

    fun selectSpecies(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedSpeciesId = id, selectedSpeciesName = name,
            speciesExpanded = false, errors = _uiState.value.errors - "species",
        )
    }

    fun toggleSpeciesDropdown() {
        _uiState.value = _uiState.value.copy(speciesExpanded = !_uiState.value.speciesExpanded)
    }

    fun selectFaoArea(area: String) {
        _uiState.value = _uiState.value.copy(
            selectedFaoArea = area, faoAreaExpanded = false,
            errors = _uiState.value.errors - "faoArea",
        )
    }

    fun toggleFaoAreaDropdown() {
        _uiState.value = _uiState.value.copy(faoAreaExpanded = !_uiState.value.faoAreaExpanded)
    }

    fun updateQuantityKg(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                quantityKg = value, errors = _uiState.value.errors - "quantity",
            )
        }
    }

    fun updateVesselName(value: String) {
        _uiState.value = _uiState.value.copy(vesselName = value)
    }

    fun selectGearType(gear: String) {
        _uiState.value = _uiState.value.copy(
            selectedGearType = gear, gearTypeExpanded = false,
        )
    }

    fun toggleGearTypeDropdown() {
        _uiState.value = _uiState.value.copy(gearTypeExpanded = !_uiState.value.gearTypeExpanded)
    }

    fun updateLandingSite(value: String) {
        _uiState.value = _uiState.value.copy(landingSite = value)
    }

    fun setCaptureDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(captureDate = dateMillis)
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
                    gpsLat = location?.latitude, gpsLng = location?.longitude,
                    gpsAccuracy = location?.accuracy, isCapturingGps = false,
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
        if (s.selectedFaoArea.isEmpty()) errors["faoArea"] = "FAO catch area is required"
        if (s.quantityKg.isEmpty()) errors["quantity"] = "Quantity is required"
        else if ((s.quantityKg.toDoubleOrNull() ?: 0.0) <= 0.0) errors["quantity"] = "Must be positive"
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
                domain = "fisheries",
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
                domain = "fisheries",
            )
            _uiState.value = _uiState.value.copy(isSaved = true, saveMode = "submit")
        }
    }

    private fun buildJsonData(): String {
        val state = _uiState.value
        return buildJsonObject {
            put("type", "capture_record")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("faoArea", state.selectedFaoArea)
            put("quantityKg", state.quantityKg.toDoubleOrNull() ?: 0.0)
            put("vesselName", state.vesselName)
            put("gearType", state.selectedGearType)
            put("landingSite", state.landingSite)
            put("captureDate", state.captureDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
