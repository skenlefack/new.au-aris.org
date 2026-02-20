package org.auibar.aris.mobile.ui.livestock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class ProductionUiState(
    val selectedSpeciesId: String = "",
    val selectedSpeciesName: String = "",
    val speciesExpanded: Boolean = false,
    val selectedProduct: String = "",
    val productExpanded: Boolean = false,
    val quantity: String = "",
    val selectedUnit: String = "",
    val unitExpanded: Boolean = false,
)

@HiltViewModel
class ProductionRecordViewModel @Inject constructor(
    private val speciesDao: SpeciesDao,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProductionUiState())
    val uiState: StateFlow<ProductionUiState> = _uiState.asStateFlow()

    val speciesList = speciesDao.getAll()

    fun selectSpecies(id: String, name: String) {
        _uiState.value = _uiState.value.copy(
            selectedSpeciesId = id,
            selectedSpeciesName = name,
            speciesExpanded = false,
        )
    }

    fun toggleSpeciesDropdown() {
        _uiState.value = _uiState.value.copy(speciesExpanded = !_uiState.value.speciesExpanded)
    }

    fun selectProduct(product: String) {
        _uiState.value = _uiState.value.copy(
            selectedProduct = product,
            productExpanded = false,
        )
    }

    fun toggleProductDropdown() {
        _uiState.value = _uiState.value.copy(productExpanded = !_uiState.value.productExpanded)
    }

    fun updateQuantity(value: String) {
        // Allow digits and decimal point
        if (value.all { it.isDigit() || it == '.' } || value.isEmpty()) {
            _uiState.value = _uiState.value.copy(quantity = value)
        }
    }

    fun selectUnit(unit: String) {
        _uiState.value = _uiState.value.copy(
            selectedUnit = unit,
            unitExpanded = false,
        )
    }

    fun toggleUnitDropdown() {
        _uiState.value = _uiState.value.copy(unitExpanded = !_uiState.value.unitExpanded)
    }

    fun save(campaignId: String) {
        val state = _uiState.value
        val data = buildJsonObject {
            put("type", "production_record")
            put("speciesId", state.selectedSpeciesId)
            put("speciesName", state.selectedSpeciesName)
            put("productType", state.selectedProduct)
            put("quantity", state.quantity.toDoubleOrNull() ?: 0.0)
            put("unit", state.selectedUnit)
        }.toString()

        viewModelScope.launch {
            submissionRepository.saveDraft(
                id = UUID.randomUUID().toString(),
                tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId,
                templateId = "production_record",
                data = data,
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
            )
        }
    }
}
