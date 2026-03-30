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

data class AquacultureUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val selectedFarmType: String = "",
    val farmTypeExpanded: Boolean = false,
    val productionTonnes: String = "",
    val areaHectares: String = "",
    val selectedWaterSource: String = "",
    val waterSourceExpanded: Boolean = false,
    val stockingDensity: String = "",
    val productionDate: Long? = null,
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
class AquacultureRecordViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val speciesDao: SpeciesDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(AquacultureUiState())
    val uiState: StateFlow<AquacultureUiState> = _uiState.asStateFlow()

    private val _speciesList = MutableStateFlow<List<SpeciesEntity>>(emptyList())
    val speciesList: StateFlow<List<SpeciesEntity>> = _speciesList.asStateFlow()

    val farmTypes = listOf(
        "Pond", "Cage", "Raceway", "Recirculating (RAS)", "Integrated (IMTA)",
    )

    val waterSources = listOf(
        "Freshwater", "Brackish", "Marine", "Recirculated",
    )

    init {
        viewModelScope.launch {
            _speciesList.value = speciesDao.getByCategory("aquatic")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "aquaculture_record"
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

    fun selectFarmType(farmType: String) {
        _uiState.value = _uiState.value.copy(
            selectedFarmType = farmType, farmTypeExpanded = false,
            errors = _uiState.value.errors - "farmType",
        )
    }

    fun toggleFarmTypeDropdown() {
        _uiState.value = _uiState.value.copy(farmTypeExpanded = !_uiState.value.farmTypeExpanded)
    }

    fun updateProductionTonnes(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                productionTonnes = value, errors = _uiState.value.errors - "production",
            )
        }
    }

    fun updateAreaHectares(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(areaHectares = value)
        }
    }

    fun selectWaterSource(waterSource: String) {
        _uiState.value = _uiState.value.copy(
            selectedWaterSource = waterSource, waterSourceExpanded = false,
        )
    }

    fun toggleWaterSourceDropdown() {
        _uiState.value = _uiState.value.copy(waterSourceExpanded = !_uiState.value.waterSourceExpanded)
    }

    fun updateStockingDensity(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(stockingDensity = value)
        }
    }

    fun setProductionDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(productionDate = dateMillis)
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
        if (s.selectedFarmType.isEmpty()) errors["farmType"] = "Farm type is required"
        if (s.productionTonnes.isEmpty()) errors["production"] = "Production is required"
        else if ((s.productionTonnes.toDoubleOrNull() ?: 0.0) <= 0.0) errors["production"] = "Must be positive"
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
            put("type", "aquaculture_record")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("farmType", state.selectedFarmType)
            put("productionTonnes", state.productionTonnes.toDoubleOrNull() ?: 0.0)
            put("areaHectares", state.areaHectares.toDoubleOrNull() ?: 0.0)
            put("waterSource", state.selectedWaterSource)
            put("stockingDensity", state.stockingDensity.toDoubleOrNull() ?: 0.0)
            put("productionDate", state.productionDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
