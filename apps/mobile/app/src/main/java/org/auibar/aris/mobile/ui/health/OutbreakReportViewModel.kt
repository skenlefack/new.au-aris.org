package org.auibar.aris.mobile.ui.health

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
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class OutbreakUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val selectedDiseaseId: String = "",
    val selectedDiseaseName: String = "",
    val diseaseExpanded: Boolean = false,
    val suspicionDate: Long? = null,
    val confirmationDate: Long? = null,
    val morbidity: String = "",
    val mortality: String = "",
    val sampleCount: String = "",
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
class OutbreakReportViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(OutbreakUiState())
    val uiState: StateFlow<OutbreakUiState> = _uiState.asStateFlow()

    private val _speciesList = MutableStateFlow<List<SpeciesEntity>>(emptyList())
    val speciesList: StateFlow<List<SpeciesEntity>> = _speciesList.asStateFlow()

    private val _diseaseList = MutableStateFlow<List<DiseaseEntity>>(emptyList())
    val diseaseList: StateFlow<List<DiseaseEntity>> = _diseaseList.asStateFlow()

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getAll()
            _diseaseList.value = diseaseDao.getNotifiable()
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "outbreak_report"
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

    fun selectDisease(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedDiseaseId = id, selectedDiseaseName = name,
            diseaseExpanded = false, errors = _uiState.value.errors - "disease",
        )
    }

    fun toggleDiseaseDropdown() {
        _uiState.value = _uiState.value.copy(diseaseExpanded = !_uiState.value.diseaseExpanded)
    }

    fun setSuspicionDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            suspicionDate = dateMillis, errors = _uiState.value.errors - "suspicionDate",
        )
    }

    fun setConfirmationDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            confirmationDate = dateMillis, errors = _uiState.value.errors - "confirmationDate",
        )
    }

    fun updateMorbidity(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                morbidity = value, errors = _uiState.value.errors - "morbidity",
            )
        }
    }

    fun updateMortality(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                mortality = value, errors = _uiState.value.errors - "mortality",
            )
        }
    }

    fun updateSampleCount(value: String) {
        if (value.all { it.isDigit() } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(sampleCount = value)
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
        if (s.selectedDiseaseId.isEmpty()) errors["disease"] = "Disease is required"
        if (s.morbidity.isEmpty()) errors["morbidity"] = "Morbidity count is required"
        if (s.mortality.isEmpty()) errors["mortality"] = "Mortality count is required"
        // Temporal consistency: confirmation >= suspicion
        if (s.suspicionDate != null && s.confirmationDate != null && s.confirmationDate < s.suspicionDate) {
            errors["confirmationDate"] = "Confirmation must be after suspicion"
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
                domain = "health",
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
                domain = "health",
            )
            _uiState.value = _uiState.value.copy(isSaved = true, saveMode = "submit")
        }
    }

    private fun buildJsonData(): String {
        val state = _uiState.value
        return buildJsonObject {
            put("type", "outbreak_report")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("diseaseId", state.selectedDiseaseId)
            put("diseaseName", state.selectedDiseaseName)
            put("suspicionDate", state.suspicionDate ?: 0L)
            put("confirmationDate", state.confirmationDate ?: 0L)
            put("morbidity", state.morbidity.toLongOrNull() ?: 0L)
            put("mortality", state.mortality.toLongOrNull() ?: 0L)
            put("sampleCount", state.sampleCount.toLongOrNull() ?: 0L)
            put("notes", state.notes)
        }.toString()
    }
}
