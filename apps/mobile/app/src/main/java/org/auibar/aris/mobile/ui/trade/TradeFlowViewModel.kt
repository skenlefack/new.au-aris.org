package org.auibar.aris.mobile.ui.trade

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

data class TradeFlowUiState(
    val selectedCommodity: String = "",
    val commodityExpanded: Boolean = false,
    val selectedOriginId: String = "",
    val selectedOriginName: String = "",
    val originExpanded: Boolean = false,
    val selectedDestinationId: String = "",
    val selectedDestinationName: String = "",
    val destinationExpanded: Boolean = false,
    val quantityTonnes: String = "",
    val valueUsd: String = "",
    val spsCertRef: String = "",
    val borderPoint: String = "",
    val tradeDate: Long? = null,
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
class TradeFlowViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val geoDao: GeoDao,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    companion object {
        val commodities = listOf(
            "Live animals",
            "Meat & meat products",
            "Dairy products",
            "Fish & seafood",
            "Hides & skins",
            "Wool & hair",
            "Honey & beeswax",
            "Animal feed",
        )
    }

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(TradeFlowUiState())
    val uiState: StateFlow<TradeFlowUiState> = _uiState.asStateFlow()

    private val _countryList = MutableStateFlow<List<GeoEntity>>(emptyList())
    val countryList: StateFlow<List<GeoEntity>> = _countryList.asStateFlow()

    init {
        viewModelScope.launch {
            _countryList.value = geoDao.getByLevel("country")
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "trade_flow"
        }
    }

    fun selectCommodity(commodity: String) {
        _uiState.value = _uiState.value.copy(
            selectedCommodity = commodity,
            commodityExpanded = false,
            errors = _uiState.value.errors - "commodity",
        )
    }

    fun toggleCommodityDropdown() {
        _uiState.value = _uiState.value.copy(commodityExpanded = !_uiState.value.commodityExpanded)
    }

    fun selectOrigin(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedOriginId = id,
            selectedOriginName = name,
            originExpanded = false,
            errors = _uiState.value.errors - "origin",
        )
    }

    fun toggleOriginDropdown() {
        _uiState.value = _uiState.value.copy(originExpanded = !_uiState.value.originExpanded)
    }

    fun selectDestination(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedDestinationId = id,
            selectedDestinationName = name,
            destinationExpanded = false,
            errors = _uiState.value.errors - "destination",
        )
    }

    fun toggleDestinationDropdown() {
        _uiState.value = _uiState.value.copy(destinationExpanded = !_uiState.value.destinationExpanded)
    }

    fun updateQuantityTonnes(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                quantityTonnes = value,
                errors = _uiState.value.errors - "quantity",
            )
        }
    }

    fun updateValueUsd(value: String) {
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                valueUsd = value,
                errors = _uiState.value.errors - "valueUsd",
            )
        }
    }

    fun updateSpsCertRef(value: String) {
        _uiState.value = _uiState.value.copy(spsCertRef = value)
    }

    fun updateBorderPoint(value: String) {
        _uiState.value = _uiState.value.copy(borderPoint = value)
    }

    fun setTradeDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            tradeDate = dateMillis,
            errors = _uiState.value.errors - "tradeDate",
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
        if (s.selectedCommodity.isEmpty()) errors["commodity"] = "Commodity is required"
        if (s.selectedOriginId.isEmpty()) errors["origin"] = "Origin country is required"
        if (s.selectedDestinationId.isEmpty()) errors["destination"] = "Destination country is required"
        if (s.quantityTonnes.isEmpty()) errors["quantity"] = "Quantity is required"
        else if ((s.quantityTonnes.toDoubleOrNull() ?: 0.0) <= 0.0) errors["quantity"] = "Must be positive"
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
            put("type", "trade_flow")
            put("domain", "trade")
            put("commodity", state.selectedCommodity)
            put("originCountryId", state.selectedOriginId)
            put("originCountryName", state.selectedOriginName)
            put("destinationCountryId", state.selectedDestinationId)
            put("destinationCountryName", state.selectedDestinationName)
            put("quantityTonnes", state.quantityTonnes.toDoubleOrNull() ?: 0.0)
            put("valueUsd", state.valueUsd.toDoubleOrNull() ?: 0.0)
            put("spsCertRef", state.spsCertRef)
            put("borderPoint", state.borderPoint)
            put("tradeDate", state.tradeDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
