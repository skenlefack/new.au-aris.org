package org.auibar.aris.mobile.ui.form

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.FormTemplateRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.ui.form.engine.FormSchemaParser
import org.auibar.aris.mobile.ui.form.engine.FormValidator
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.SelectOption
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

data class FormFillUiState(
    val isLoading: Boolean = true,
    val campaignName: String = "",
    val templateName: String = "",
    val fields: List<FormField> = emptyList(),
    val values: Map<String, String> = emptyMap(),
    val errors: Map<String, String> = emptyMap(),
    val speciesOptions: List<SelectOption> = emptyList(),
    val diseaseOptions: List<SelectOption> = emptyList(),
    val countryOptions: List<SelectOption> = emptyList(),
    val admin1Options: List<SelectOption> = emptyList(),
    val admin2Options: List<SelectOption> = emptyList(),
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsAccuracy: Float? = null,
    val photoUri: String? = null,
    val submissionId: String = UUID.randomUUID().toString(),
)

sealed class FormEvent {
    data object DraftSaved : FormEvent()
    data object Submitted : FormEvent()
    data class Error(val message: String) : FormEvent()
}

@HiltViewModel
class FormFillViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val campaignRepository: CampaignRepository,
    private val formTemplateRepository: FormTemplateRepository,
    private val submissionRepository: SubmissionRepository,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private val parser = FormSchemaParser()
    private val validator = FormValidator()

    private val _uiState = MutableStateFlow(FormFillUiState())
    val uiState: StateFlow<FormFillUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<FormEvent>()
    val events = _events.asSharedFlow()

    init {
        loadForm()
    }

    private fun loadForm() {
        viewModelScope.launch {
            try {
                val campaign = campaignRepository.getById(campaignId)
                    ?: throw IllegalStateException("Campaign not found")
                val template = formTemplateRepository.getById(campaign.templateId)
                    ?: throw IllegalStateException("Template not found")

                val fields = parser.parse(template.schema, template.uiSchema)

                val species = speciesDao.getAll().map {
                    SelectOption(value = it.id, label = "${it.commonName} (${it.scientificName})")
                }
                val diseases = diseaseDao.getAll().map {
                    SelectOption(value = it.id, label = it.name)
                }
                val countries = geoDao.getByLevel("COUNTRY").map {
                    SelectOption(value = it.id, label = it.name)
                }

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    campaignName = campaign.name,
                    templateName = template.name,
                    fields = fields,
                    speciesOptions = species,
                    diseaseOptions = diseases,
                    countryOptions = countries,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                _events.emit(FormEvent.Error(e.message ?: "Failed to load form"))
            }
        }
    }

    fun onValueChange(key: String, value: String) {
        val newValues = _uiState.value.values.toMutableMap()
        newValues[key] = value
        _uiState.value = _uiState.value.copy(
            values = newValues,
            errors = _uiState.value.errors - key,
        )

        if (key == "_country") {
            newValues.remove("_admin1")
            newValues.remove("_admin2")
            _uiState.value = _uiState.value.copy(values = newValues, admin1Options = emptyList(), admin2Options = emptyList())
            loadAdmin1(value)
        } else if (key == "_admin1") {
            newValues.remove("_admin2")
            _uiState.value = _uiState.value.copy(values = newValues, admin2Options = emptyList())
            loadAdmin2(value)
        }
    }

    private fun loadAdmin1(countryId: String) {
        viewModelScope.launch {
            val children = geoDao.getChildren(countryId).map {
                SelectOption(value = it.id, label = it.name)
            }
            _uiState.value = _uiState.value.copy(admin1Options = children)
        }
    }

    private fun loadAdmin2(admin1Id: String) {
        viewModelScope.launch {
            val children = geoDao.getChildren(admin1Id).map {
                SelectOption(value = it.id, label = it.name)
            }
            _uiState.value = _uiState.value.copy(admin2Options = children)
        }
    }

    fun onLocationCaptured(lat: Double, lng: Double, accuracy: Float) {
        val newValues = _uiState.value.values.toMutableMap()
        newValues["_location"] = "%.6f, %.6f".format(lat, lng)
        _uiState.value = _uiState.value.copy(
            values = newValues,
            gpsLat = lat,
            gpsLng = lng,
            gpsAccuracy = accuracy,
        )
    }

    fun onPhotoCaptured(uri: String) {
        val newValues = _uiState.value.values.toMutableMap()
        newValues["_photo"] = uri
        _uiState.value = _uiState.value.copy(values = newValues, photoUri = uri)
    }

    fun saveDraft() {
        viewModelScope.launch {
            val state = _uiState.value
            val dataJson = buildDataJson(state.values)
            submissionRepository.saveDraft(
                id = state.submissionId,
                tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId,
                templateId = "",
                data = dataJson,
                gpsLat = state.gpsLat,
                gpsLng = state.gpsLng,
                gpsAccuracy = state.gpsAccuracy,
            )
            _events.emit(FormEvent.DraftSaved)
        }
    }

    fun submit() {
        viewModelScope.launch {
            val state = _uiState.value
            val validationErrors = validator.validate(state.fields, state.values)
            if (validationErrors.isNotEmpty()) {
                _uiState.value = state.copy(
                    errors = validationErrors.associate { it.field to it.message }
                )
                return@launch
            }

            val dataJson = buildDataJson(state.values)
            submissionRepository.submitForm(
                id = state.submissionId,
                tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId,
                templateId = "",
                data = dataJson,
                gpsLat = state.gpsLat,
                gpsLng = state.gpsLng,
                gpsAccuracy = state.gpsAccuracy,
            )
            _events.emit(FormEvent.Submitted)
        }
    }

    private fun buildDataJson(values: Map<String, String>): String {
        val entries = values.filterKeys { !it.startsWith("_") }
            .mapValues { (_, v) -> JsonPrimitive(v) }
        return JsonObject(entries).toString()
    }
}
