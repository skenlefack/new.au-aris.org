package org.auibar.aris.mobile.ui.governance

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
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class VetCapacityUiState(
    val selectedFacilityType: String = "",
    val facilityTypeExpanded: Boolean = false,
    val staffCount: String = "",
    val selectedEquipmentLevel: String = "",
    val equipmentLevelExpanded: Boolean = false,
    val selectedAccreditationStatus: String = "",
    val accreditationStatusExpanded: Boolean = false,
    val selectedLocationId: String = "",
    val selectedLocationName: String = "",
    val locationExpanded: Boolean = false,
    val notes: String = "",
    // GPS
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
class VetCapacityViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val geoDao: GeoDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(VetCapacityUiState())
    val uiState: StateFlow<VetCapacityUiState> = _uiState.asStateFlow()

    private val _geoList = MutableStateFlow<List<GeoEntity>>(emptyList())
    val geoList: StateFlow<List<GeoEntity>> = _geoList.asStateFlow()

    init {
        viewModelScope.launch {
            _geoList.value = geoDao.getByLevel("admin1")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "vet_capacity"
        }
    }

    companion object {
        val facilityTypes = listOf(
            "Veterinary laboratory",
            "Quarantine station",
            "Border inspection post",
            "Veterinary clinic",
            "Regional office",
            "Training center",
        )

        val equipmentLevels = listOf(
            "Fully equipped",
            "Adequately equipped",
            "Partially equipped",
            "Under-equipped",
            "Non-functional",
        )

        val accreditationStatuses = listOf(
            "Accredited",
            "Provisionally accredited",
            "Not accredited",
            "Accreditation expired",
            "Under evaluation",
        )
    }

    fun selectFacilityType(type: String) {
        _uiState.value = _uiState.value.copy(
            selectedFacilityType = type,
            facilityTypeExpanded = false,
            errors = _uiState.value.errors - "facilityType",
        )
    }

    fun toggleFacilityTypeDropdown() {
        _uiState.value = _uiState.value.copy(facilityTypeExpanded = !_uiState.value.facilityTypeExpanded)
    }

    fun updateStaffCount(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                staffCount = value,
                errors = _uiState.value.errors - "staffCount",
            )
        }
    }

    fun selectEquipmentLevel(level: String) {
        _uiState.value = _uiState.value.copy(
            selectedEquipmentLevel = level,
            equipmentLevelExpanded = false,
        )
    }

    fun toggleEquipmentLevelDropdown() {
        _uiState.value = _uiState.value.copy(equipmentLevelExpanded = !_uiState.value.equipmentLevelExpanded)
    }

    fun selectAccreditationStatus(status: String) {
        _uiState.value = _uiState.value.copy(
            selectedAccreditationStatus = status,
            accreditationStatusExpanded = false,
        )
    }

    fun toggleAccreditationStatusDropdown() {
        _uiState.value = _uiState.value.copy(accreditationStatusExpanded = !_uiState.value.accreditationStatusExpanded)
    }

    fun selectLocation(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedLocationId = id,
            selectedLocationName = name,
            locationExpanded = false,
        )
    }

    fun toggleLocationDropdown() {
        _uiState.value = _uiState.value.copy(locationExpanded = !_uiState.value.locationExpanded)
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
        if (s.selectedFacilityType.isEmpty()) errors["facilityType"] = "Facility type is required"
        if (s.staffCount.isEmpty()) errors["staffCount"] = "Staff count is required"
        else if ((s.staffCount.toLongOrNull() ?: 0) <= 0) errors["staffCount"] = "Must be positive"
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
                domain = "governance",
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
                domain = "governance",
            )
            _uiState.value = _uiState.value.copy(isSaved = true, saveMode = "submit")
        }
    }

    /** Kept for backward compatibility */
    fun save() = saveDraft()

    private fun buildJsonData(): String {
        val state = _uiState.value
        return buildJsonObject {
            put("type", "vet_capacity")
            put("domain", "governance")
            put("facilityType", state.selectedFacilityType)
            put("staffCount", state.staffCount.toLongOrNull() ?: 0L)
            put("equipmentLevel", state.selectedEquipmentLevel)
            put("accreditationStatus", state.selectedAccreditationStatus)
            put("locationId", state.selectedLocationId)
            put("locationName", state.selectedLocationName)
            put("notes", state.notes)
        }.toString()
    }
}
