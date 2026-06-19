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
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.dao.RefDataCacheDao
import org.auibar.aris.mobile.data.local.entity.RefDataCacheEntity
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
    private val refDataCacheDao: RefDataCacheDao,
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

                // Try effective form (base + extensions) first, then base template
                var template: org.auibar.aris.mobile.data.repository.FormTemplate? = null

                // 1. Try effective form (campaign + tenant-scoped extensions)
                val tenantId = tokenManager.tenantId
                if (tenantId != null && campaignId.isNotBlank() && templateId.isNotBlank()) {
                    val effectiveDto = campaignApi.getEffectiveForm(campaignId, templateId, tenantId)
                    if (effectiveDto != null) {
                        val effectiveId = "${templateId}_eff_${campaignId}"
                        formTemplateDao.upsertAll(listOf(FormTemplateEntity(
                            id = effectiveId, name = effectiveDto.name, domain = effectiveDto.domain,
                            schema = effectiveDto.schema, uiSchema = effectiveDto.uiSchema,
                            version = effectiveDto.version, syncedAt = System.currentTimeMillis(),
                        )))
                        template = formTemplateRepository.getById(effectiveId)
                        Log.d(TAG, "Using effective form: $effectiveId")
                    }
                }

                // 2. Fallback: try local base template, then fetch from API
                if (template == null) {
                    template = formTemplateRepository.getById(templateId)
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
                }

                if (template == null) throw IllegalStateException("Template not found")

                val fields = parser.parse(template.schema, template.uiSchema)
                Log.d(TAG, "Parsed ${fields.size} fields, loading options...")

                // Apply default values for fields that don't have values yet
                val defaultValues = mutableMapOf<String, String>()
                fields.forEach { field ->
                    if (field.defaultValue != null && !_uiState.value.values.containsKey(field.key)) {
                        defaultValues[field.key] = field.defaultValue
                    }
                }
                if (defaultValues.isNotEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        values = _uiState.value.values + defaultValues,
                    )
                    Log.d(TAG, "Applied ${defaultValues.size} default values")
                }

                // Load geo options — try API first, fallback to local Room
                val countries = loadCountries()

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

    /** Load options from /api/v1/master-data/ref/{type}/for-select, with Room fallback. */
    private suspend fun loadMasterDataOptions(types: List<String>): Map<String, List<SelectOption>> {
        val results = mutableMapOf<String, List<SelectOption>>()
        types.map { type ->
            viewModelScope.async {
                // Try API first
                try {
                    val items = campaignApi.getRefDataForSelect(type)
                    if (items.isNotEmpty()) {
                        val options = items.map { item ->
                            SelectOption(value = item.id, label = item.displayLabel())
                        }
                        // Cache to Room for offline use
                        val cacheEntities = items.mapIndexed { idx, item ->
                            RefDataCacheEntity(
                                type = type,
                                itemId = item.id,
                                label = item.displayLabel(),
                                parentId = null,
                                sortOrder = idx,
                            )
                        }
                        refDataCacheDao.deleteByType(type)
                        refDataCacheDao.upsertAll(cacheEntities)
                        Log.d(TAG, "Ref data $type from API: ${options.size} options (cached)")
                        return@async type to options
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Ref data $type API failed (offline?): ${e.message}")
                }
                // Fallback to Room — try generic cache first (most reliable for all types),
                // then dedicated tables as last resort
                var roomOptions = refDataCacheDao.getByType(type).map {
                    SelectOption(value = it.itemId, label = it.label)
                }
                // If generic cache is empty, try dedicated Room tables
                if (roomOptions.isEmpty()) {
                    roomOptions = when (type) {
                        "species" -> speciesDao.getAll().map {
                            SelectOption(value = it.id, label = "${it.commonName} (${it.scientificName})")
                        }
                        "diseases" -> diseaseDao.getAll().map {
                            SelectOption(value = it.id, label = it.name)
                        }
                        "geo", "countries" -> geoDao.getByLevel("COUNTRY").map {
                            SelectOption(value = it.id, label = it.name)
                        }
                        else -> emptyList()
                    }
                }
                Log.d(TAG, "Ref data $type from Room: ${roomOptions.size} options")
                type to roomOptions
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

    private suspend fun loadCountries(): List<SelectOption> {
        // Try Room first (offline-first approach — geo data is bulk-synced)
        val local = geoDao.getByLevel("COUNTRY").map { SelectOption(value = it.id, label = it.name) }
        if (local.isNotEmpty()) {
            Log.d(TAG, "Countries from Room: ${local.size}")
            return local
        }
        // Fallback to API if Room is empty (first launch before sync)
        try {
            val items = campaignApi.getGeoUnits("COUNTRY", null)
            if (items.isNotEmpty()) {
                // Cache to Room for next offline use
                val entities = items.map { item ->
                    GeoEntity(id = item.id, name = item.displayLabel(), level = "COUNTRY", parentId = null, isoCode = item.code, syncedAt = System.currentTimeMillis())
                }
                geoDao.upsertAll(entities)
                Log.d(TAG, "Countries from API: ${items.size} (cached to Room)")
                return items.map { SelectOption(value = it.id, label = it.displayLabel()) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Countries API failed: ${e.message}")
        }
        return emptyList()
    }

    private fun loadAdmin1(countryId: String) {
        viewModelScope.launch {
            // Room first (offline-first)
            val cached = geoDao.getChildren(countryId).map { SelectOption(value = it.id, label = it.name) }
            if (cached.isNotEmpty()) {
                _uiState.value = _uiState.value.copy(admin1Options = cached)
                Log.d(TAG, "Admin1 from Room: ${cached.size}")
                return@launch
            }
            // API fallback + cache results
            try {
                val items = campaignApi.getGeoUnits(null, countryId)
                if (items.isNotEmpty()) {
                    val entities = items.map { item ->
                        GeoEntity(id = item.id, name = item.displayLabel(), level = "ADMIN1", parentId = countryId, isoCode = item.code, syncedAt = System.currentTimeMillis())
                    }
                    geoDao.upsertAll(entities)
                    _uiState.value = _uiState.value.copy(admin1Options = items.map { SelectOption(value = it.id, label = it.displayLabel()) })
                    Log.d(TAG, "Admin1 from API: ${items.size} (cached)")
                    return@launch
                }
            } catch (_: Exception) {}
            _uiState.value = _uiState.value.copy(admin1Options = emptyList())
        }
    }

    private fun loadAdmin2(admin1Id: String) {
        viewModelScope.launch {
            // Room first (offline-first)
            val cached = geoDao.getChildren(admin1Id).map { SelectOption(value = it.id, label = it.name) }
            if (cached.isNotEmpty()) {
                _uiState.value = _uiState.value.copy(admin2Options = cached)
                Log.d(TAG, "Admin2 from Room: ${cached.size}")
                return@launch
            }
            // API fallback + cache
            try {
                val items = campaignApi.getGeoUnits(null, admin1Id)
                if (items.isNotEmpty()) {
                    val entities = items.map { item ->
                        GeoEntity(id = item.id, name = item.displayLabel(), level = "ADMIN2", parentId = admin1Id, isoCode = item.code, syncedAt = System.currentTimeMillis())
                    }
                    geoDao.upsertAll(entities)
                    _uiState.value = _uiState.value.copy(admin2Options = items.map { SelectOption(value = it.id, label = it.displayLabel()) })
                    Log.d(TAG, "Admin2 from API: ${items.size} (cached)")
                    return@launch
                }
                // Fallback: some countries have admin2 parentId pointing to country, not admin1
                val countryId = _uiState.value.values["_country"]
                if (!countryId.isNullOrBlank()) {
                    val admin2All = campaignApi.getGeoUnits("ADMIN2", countryId)
                    if (admin2All.isNotEmpty()) {
                        val entities = admin2All.map { item ->
                            GeoEntity(id = item.id, name = item.displayLabel(), level = "ADMIN2", parentId = countryId, isoCode = item.code, syncedAt = System.currentTimeMillis())
                        }
                        geoDao.upsertAll(entities)
                        _uiState.value = _uiState.value.copy(admin2Options = admin2All.map { SelectOption(value = it.id, label = it.displayLabel()) })
                        Log.d(TAG, "Admin2 fallback from API (country=$countryId): ${admin2All.size} (cached)")
                        return@launch
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Admin2 API failed: ${e.message}")
            }
            _uiState.value = _uiState.value.copy(admin2Options = emptyList())
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
