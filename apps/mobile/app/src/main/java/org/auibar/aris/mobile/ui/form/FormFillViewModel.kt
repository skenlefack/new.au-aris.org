package org.auibar.aris.mobile.ui.form

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
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
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.remote.api.CampaignApi
import org.auibar.aris.mobile.data.repository.CampaignRepository
import org.auibar.aris.mobile.data.repository.FormTemplateRepository
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import org.auibar.aris.mobile.ui.form.engine.FormSchemaParser
import org.auibar.aris.mobile.ui.form.engine.FormValidator
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

private const val TAG = "FormFillVM"

data class FormFillUiState(
    val isLoading: Boolean = true,
    val campaignName: String = "",
    val templateId: String = "",
    val templateName: String = "",
    val fields: List<FormField> = emptyList(),
    val values: Map<String, String> = emptyMap(),
    val errors: Map<String, String> = emptyMap(),
    val speciesOptions: List<SelectOption> = emptyList(),
    val diseaseOptions: List<SelectOption> = emptyList(),
    val countryOptions: List<SelectOption> = emptyList(),
    val admin1Options: List<SelectOption> = emptyList(),
    val admin2Options: List<SelectOption> = emptyList(),
    /** Dynamic options loaded from /ref/{type}/for-select, keyed by masterDataType */
    val masterDataOptions: Map<String, List<SelectOption>> = emptyMap(),
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
    private val campaignApi: CampaignApi,
    private val formTemplateDao: FormTemplateDao,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val campaignId: String = savedStateHandle["campaignId"] ?: ""
    private val overrideTemplateId: String? = savedStateHandle["templateId"]
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
                val templateId = overrideTemplateId ?: campaign.templateId

                // Try local first, then fetch from API
                var template = formTemplateRepository.getById(templateId)
                if (template == null && templateId.isNotBlank()) {
                    val dto = campaignApi.getFormTemplate(templateId)
                    if (dto != null) {
                        formTemplateDao.upsertAll(listOf(FormTemplateEntity(
                            id = dto.id, name = dto.name, domain = dto.domain,
                            schema = dto.schema, uiSchema = dto.uiSchema,
                            version = dto.version, syncedAt = System.currentTimeMillis(),
                        )))
                        template = formTemplateRepository.getById(templateId)
                    }
                }

                if (template == null) throw IllegalStateException("Template not found")

                val fields = parser.parse(template.schema, template.uiSchema)
                Log.d(TAG, "Parsed ${fields.size} fields, loading options...")

                // Load geo options from local DB
                val countries = geoDao.getByLevel("COUNTRY").map { SelectOption(value = it.id, label = it.name) }

                // Load master data options for all unique masterDataTypes in the form
                val masterDataTypes = fields.mapNotNull { it.masterDataType }.distinct()
                val masterDataOptions = loadMasterDataOptions(masterDataTypes)

                // Also put species/diseases from master data into the classic fields
                val speciesOptions = masterDataOptions["species"] ?: speciesDao.getAll().map {
                    SelectOption(value = it.id, label = "${it.commonName} (${it.scientificName})")
                }
                val diseaseOptions = masterDataOptions["diseases"] ?: diseaseDao.getAll().map {
                    SelectOption(value = it.id, label = it.name)
                }

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    campaignName = campaign.name,
                    templateId = template.id,
                    templateName = template.name,
                    fields = fields,
                    speciesOptions = speciesOptions,
                    diseaseOptions = diseaseOptions,
                    countryOptions = countries,
                    masterDataOptions = masterDataOptions,
                )
            } catch (e: Exception) {
                Log.w(TAG, "loadForm failed: ${e.message}")
                _uiState.value = _uiState.value.copy(isLoading = false)
                _events.emit(FormEvent.Error(e.message ?: "Failed to load form"))
            }
        }
    }

    /** Load options from /api/v1/master-data/ref/{type}/for-select for each type. */
    private suspend fun loadMasterDataOptions(types: List<String>): Map<String, List<SelectOption>> {
        val results = mutableMapOf<String, List<SelectOption>>()
        types.map { type ->
            viewModelScope.async {
                val items = campaignApi.getRefDataForSelect(type)
                val options = items.map { item ->
                    val label = item.labelEn
                        ?: item.label
                        ?: item.commonName?.let { "$it${item.scientificName?.let { s -> " ($s)" } ?: ""}" }
                        ?: item.name
                        ?: item.code
                        ?: item.id
                    SelectOption(value = item.id, label = label)
                }
                Log.d(TAG, "Ref data $type: ${options.size} options")
                type to options
            }
        }.awaitAll().forEach { (type, options) ->
            results[type] = options
        }
        return results
    }

    fun onValueChange(key: String, value: String) {
        val newValues = _uiState.value.values.toMutableMap()
        newValues[key] = value
        _uiState.value = _uiState.value.copy(
            values = newValues,
            errors = _uiState.value.errors - key,
        )

        // Cascading admin location
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
            val children = geoDao.getChildren(countryId).map { SelectOption(value = it.id, label = it.name) }
            _uiState.value = _uiState.value.copy(admin1Options = children)
        }
    }

    private fun loadAdmin2(admin1Id: String) {
        viewModelScope.launch {
            val children = geoDao.getChildren(admin1Id).map { SelectOption(value = it.id, label = it.name) }
            _uiState.value = _uiState.value.copy(admin2Options = children)
        }
    }

    fun onLocationCaptured(lat: Double, lng: Double, accuracy: Float) {
        val newValues = _uiState.value.values.toMutableMap()
        newValues["_location"] = "%.6f, %.6f".format(lat, lng)
        _uiState.value = _uiState.value.copy(values = newValues, gpsLat = lat, gpsLng = lng, gpsAccuracy = accuracy)
    }

    fun onPhotoCaptured(uri: String) {
        val newValues = _uiState.value.values.toMutableMap()
        newValues["_photo"] = uri
        _uiState.value = _uiState.value.copy(values = newValues, photoUri = uri)
    }

    fun saveDraft() {
        viewModelScope.launch {
            val state = _uiState.value
            submissionRepository.saveDraft(
                id = state.submissionId, tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId, templateId = state.templateId,
                data = buildDataJson(state.values),
                gpsLat = state.gpsLat, gpsLng = state.gpsLng, gpsAccuracy = state.gpsAccuracy,
            )
            _events.emit(FormEvent.DraftSaved)
        }
    }

    fun submit() {
        viewModelScope.launch {
            val state = _uiState.value
            val validationErrors = validator.validate(state.fields, state.values)
            if (validationErrors.isNotEmpty()) {
                _uiState.value = state.copy(errors = validationErrors.associate { it.field to it.message })
                return@launch
            }
            submissionRepository.submitForm(
                id = state.submissionId, tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId, templateId = state.templateId,
                data = buildDataJson(state.values),
                gpsLat = state.gpsLat, gpsLng = state.gpsLng, gpsAccuracy = state.gpsAccuracy,
            )
            _events.emit(FormEvent.Submitted)
        }
    }

    private fun buildDataJson(values: Map<String, String>): String {
        val entries = values.filterKeys { !it.startsWith("_") }.mapValues { (_, v) -> JsonPrimitive(v) }
        return JsonObject(entries).toString()
    }
}
