package org.auibar.aris.mobile.ui.livestock

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
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.GeoEntity
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
    // New fields
    val censusDate: Long? = null,
    val notes: String = "",
    val selectedGeoId: String = "",
    val selectedGeoName: String = "",
    val geoExpanded: Boolean = false,
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
class LivestockCensusViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val speciesDao: SpeciesDao,
    private val geoDao: GeoDao,
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

    private val _geoList = MutableStateFlow<List<GeoEntity>>(emptyList())
    val geoList: StateFlow<List<GeoEntity>> = _geoList.asStateFlow()

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getAll()
            _geoList.value = geoDao.getByLevel("admin1")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "livestock_census"
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

    fun updatePopulationCount(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                populationCount = value,
                errors = _uiState.value.errors - "population",
            )
        }
    }

    fun selectMethodology(method: String) {
        _uiState.value = _uiState.value.copy(
            selectedMethodology = method,
            methodologyExpanded = false,
            errors = _uiState.value.errors - "methodology",
        )
    }

    fun toggleMethodologyDropdown() {
        _uiState.value = _uiState.value.copy(methodologyExpanded = !_uiState.value.methodologyExpanded)
    }

    fun setCensusDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            censusDate = dateMillis,
            errors = _uiState.value.errors - "date",
        )
    }

    fun updateNotes(value: String) {
        _uiState.value = _uiState.value.copy(notes = value)
    }

    fun selectGeo(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedGeoId = id,
            selectedGeoName = name,
            geoExpanded = false,
        )
    }

    fun toggleGeoDropdown() {
        _uiState.value = _uiState.value.copy(geoExpanded = !_uiState.value.geoExpanded)
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
        if (s.populationCount.isEmpty()) errors["population"] = "Population count is required"
        else if ((s.populationCount.toLongOrNull() ?: 0) <= 0) errors["population"] = "Must be positive"
        if (s.selectedMethodology.isEmpty()) errors["methodology"] = "Methodology is required"
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
            put("type", "livestock_census")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("populationCount", state.populationCount.toLongOrNull() ?: 0L)
            put("methodology", state.selectedMethodology)
            put("censusDate", state.censusDate ?: System.currentTimeMillis())
            put("notes", state.notes)
            put("geoUnitId", state.selectedGeoId)
            put("geoUnitName", state.selectedGeoName)
        }.toString()
    }
}
