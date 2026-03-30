package org.auibar.aris.mobile.ui.governance

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class LegalFrameworkUiState(
    val lawTitle: String = "",
    val selectedLawType: String = "",
    val lawTypeExpanded: Boolean = false,
    val adoptionDate: Long? = null,
    val selectedLawStatus: String = "",
    val lawStatusExpanded: Boolean = false,
    val selectedScope: String = "",
    val scopeExpanded: Boolean = false,
    val implementingBody: String = "",
    val notes: String = "",
    // Validation
    val errors: Map<String, String> = emptyMap(),
    val isSaved: Boolean = false,
    val saveMode: String = "",
)

@HiltViewModel
class LegalFrameworkViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val campaignRepository: CampaignRepository,
    private val submissionRepository: SubmissionRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private var resolvedTemplateId: String = ""

    private val _uiState = MutableStateFlow(LegalFrameworkUiState())
    val uiState: StateFlow<LegalFrameworkUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val campaign = campaignRepository.getById(campaignId)
            resolvedTemplateId = campaign?.templateId ?: "legal_framework"
        }
    }

    companion object {
        val lawTypes = listOf(
            "Act of Parliament",
            "Decree",
            "Regulation",
            "Order",
            "Policy",
            "Standard",
            "Guideline",
        )

        val lawStatuses = listOf(
            "In force",
            "Draft",
            "Under review",
            "Repealed",
            "Suspended",
        )

        val scopes = listOf(
            "National",
            "Regional",
            "Continental",
            "International",
        )
    }

    fun updateLawTitle(value: String) {
        _uiState.value = _uiState.value.copy(
            lawTitle = value,
            errors = _uiState.value.errors - "lawTitle",
        )
    }

    fun selectLawType(type: String) {
        _uiState.value = _uiState.value.copy(
            selectedLawType = type,
            lawTypeExpanded = false,
            errors = _uiState.value.errors - "lawType",
        )
    }

    fun toggleLawTypeDropdown() {
        _uiState.value = _uiState.value.copy(lawTypeExpanded = !_uiState.value.lawTypeExpanded)
    }

    fun setAdoptionDate(dateMillis: Long) {
        _uiState.value = _uiState.value.copy(
            adoptionDate = dateMillis,
            errors = _uiState.value.errors - "date",
        )
    }

    fun selectLawStatus(status: String) {
        _uiState.value = _uiState.value.copy(
            selectedLawStatus = status,
            lawStatusExpanded = false,
            errors = _uiState.value.errors - "lawStatus",
        )
    }

    fun toggleLawStatusDropdown() {
        _uiState.value = _uiState.value.copy(lawStatusExpanded = !_uiState.value.lawStatusExpanded)
    }

    fun selectScope(scope: String) {
        _uiState.value = _uiState.value.copy(
            selectedScope = scope,
            scopeExpanded = false,
        )
    }

    fun toggleScopeDropdown() {
        _uiState.value = _uiState.value.copy(scopeExpanded = !_uiState.value.scopeExpanded)
    }

    fun updateImplementingBody(value: String) {
        _uiState.value = _uiState.value.copy(implementingBody = value)
    }

    fun updateNotes(value: String) {
        _uiState.value = _uiState.value.copy(notes = value)
    }

    private fun validate(): Map<String, String> {
        val errors = mutableMapOf<String, String>()
        val s = _uiState.value
        if (s.lawTitle.isBlank()) errors["lawTitle"] = "Law title is required"
        if (s.selectedLawType.isEmpty()) errors["lawType"] = "Law type is required"
        if (s.selectedLawStatus.isEmpty()) errors["lawStatus"] = "Law status is required"
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
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
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
                gpsLat = null,
                gpsLng = null,
                gpsAccuracy = null,
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
            put("type", "legal_framework")
            put("domain", "governance")
            put("lawTitle", state.lawTitle)
            put("lawType", state.selectedLawType)
            put("adoptionDate", state.adoptionDate ?: System.currentTimeMillis())
            put("lawStatus", state.selectedLawStatus)
            put("scope", state.selectedScope)
            put("implementingBody", state.implementingBody)
            put("notes", state.notes)
        }.toString()
    }
}
