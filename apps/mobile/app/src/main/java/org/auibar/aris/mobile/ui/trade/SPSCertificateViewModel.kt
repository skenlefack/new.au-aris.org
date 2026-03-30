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
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class SpsCertificateUiState(
    val certNumber: String = "",
    val selectedCertType: String = "",
    val certTypeExpanded: Boolean = false,
    val commodity: String = "",
    val exporterName: String = "",
    val importerName: String = "",
    val validityStart: Long? = null,
    val validityEnd: Long? = null,
    val selectedStatus: String = "",
    val statusExpanded: Boolean = false,
    val issueDate: Long? = null,
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
class SPSCertificateViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    companion object {
        val certTypes = listOf(
            "Export health certificate",
            "Import permit",
            "Transit certificate",
            "Phytosanitary certificate",
            "Veterinary certificate",
        )

        val statuses = listOf(
            "Active",
            "Expired",
            "Suspended",
            "Revoked",
        )
    }

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(SpsCertificateUiState())
    val uiState: StateFlow<SpsCertificateUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "sps_certificate"
        }
    }

    fun updateCertNumber(value: String) {
        _uiState.value = _uiState.value.copy(
            certNumber = value,
            errors = _uiState.value.errors - "certNumber",
        )
    }

    fun selectCertType(certType: String) {
        _uiState.value = _uiState.value.copy(
            selectedCertType = certType,
            certTypeExpanded = false,
            errors = _uiState.value.errors - "certType",
        )
    }

    fun toggleCertTypeDropdown() {
        _uiState.value = _uiState.value.copy(certTypeExpanded = !_uiState.value.certTypeExpanded)
    }

    fun updateCommodity(value: String) {
        _uiState.value = _uiState.value.copy(
            commodity = value,
            errors = _uiState.value.errors - "commodity",
        )
    }

    fun updateExporterName(value: String) {
        _uiState.value = _uiState.value.copy(exporterName = value)
    }

    fun updateImporterName(value: String) {
        _uiState.value = _uiState.value.copy(importerName = value)
    }

    fun setValidityStart(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            validityStart = dateMillis,
            errors = _uiState.value.errors - "validityRange",
        )
    }

    fun setValidityEnd(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            validityEnd = dateMillis,
            errors = _uiState.value.errors - "validityRange",
        )
    }

    fun selectStatus(status: String) {
        _uiState.value = _uiState.value.copy(
            selectedStatus = status,
            statusExpanded = false,
        )
    }

    fun toggleStatusDropdown() {
        _uiState.value = _uiState.value.copy(statusExpanded = !_uiState.value.statusExpanded)
    }

    fun setIssueDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(issueDate = dateMillis)
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
        if (s.certNumber.isEmpty()) errors["certNumber"] = "Certificate number is required"
        if (s.selectedCertType.isEmpty()) errors["certType"] = "Certificate type is required"
        if (s.commodity.isEmpty()) errors["commodity"] = "Commodity is required"
        // Temporal validation: validityEnd >= validityStart
        if (s.validityStart != null && s.validityEnd != null && s.validityEnd < s.validityStart) {
            errors["validityRange"] = "Validity end must be on or after validity start"
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
            put("type", "sps_certificate")
            put("domain", "trade")
            put("certNumber", state.certNumber)
            put("certType", state.selectedCertType)
            put("commodity", state.commodity)
            put("exporterName", state.exporterName)
            put("importerName", state.importerName)
            put("validityStart", state.validityStart ?: 0L)
            put("validityEnd", state.validityEnd ?: 0L)
            put("status", state.selectedStatus)
            put("issueDate", state.issueDate ?: System.currentTimeMillis())
            put("notes", state.notes)
        }.toString()
    }
}
