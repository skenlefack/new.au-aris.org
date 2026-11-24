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
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
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
import org.auibar.aris.mobile.ui.form.engine.AdminFieldView
import org.auibar.aris.mobile.ui.form.engine.AdminLevelConfig
import org.auibar.aris.mobile.ui.form.engine.AdminLocation
import org.auibar.aris.mobile.ui.form.engine.FormSchemaParser
import org.auibar.aris.mobile.ui.form.engine.FormValidator
import org.auibar.aris.mobile.ui.form.model.FormField
import org.auibar.aris.mobile.ui.form.model.FormFieldType
import org.auibar.aris.mobile.ui.form.model.SelectOption
import org.auibar.aris.mobile.util.TokenManager
import java.util.UUID
import javax.inject.Inject

private const val TAG = "FormFillVM"
private const val ADMIN_API_TIMEOUT_MS = 6_000L
private val adminJson = Json { ignoreUnknownKeys = true }

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
    /** Options of each admin-location level, keyed by AdminLocation.key(fieldKey, level) */
    val adminOptions: Map<String, List<SelectOption>> = emptyMap(),
    /** Admin levels configured per country ISO code (empty list = no configuration) */
    val adminLevelsByCountry: Map<String, List<AdminLevelConfig>> = emptyMap(),
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

        // Cascading admin location: "<fieldKey>.level_<n>"
        val (fieldKey, level) = AdminLocation.parseKey(key) ?: return
        val field = _uiState.value.fields.firstOrNull { it.key == fieldKey && it.type == FormFieldType.ADMIN_CASCADER } ?: return
        val options = _uiState.value.adminOptions.toMutableMap()
        field.adminLevels.filter { it > level }.forEach { deeper ->
            newValues.remove(AdminLocation.key(fieldKey, deeper))
            options.remove(AdminLocation.key(fieldKey, deeper))
        }
        _uiState.value = _uiState.value.copy(values = newValues, adminOptions = options)
        if (value.isBlank()) return
        viewModelScope.launch {
            if (level == 0) loadAdminLevels(value)
            val next = adminFieldView(field).levels.firstOrNull { it > level } ?: return@launch
            val countryId = countryIdByCode[newValues[AdminLocation.key(fieldKey, 0)].orEmpty()]
            val parentId = if (level == 0) countryId ?: return@launch else value
            val children = loadGeoChildren(parentId, next, countryId)
            _uiState.value = _uiState.value.copy(
                adminOptions = _uiState.value.adminOptions + (AdminLocation.key(fieldKey, next) to children),
            )
        }
    }

    /** ISO country code -> geo entity id (children are looked up by parent id). */
    private var countryIdByCode: Map<String, String> = emptyMap()

    /** Levels and labels shown for an admin-location field, given the selected country. */
    fun adminFieldView(field: FormField, state: FormFillUiState = _uiState.value): AdminFieldView {
        val country = state.values[AdminLocation.key(field.key, 0)].orEmpty()
        val configured = state.adminLevelsByCountry[country]
        val language = tokenManager.language
        return AdminFieldView(
            levels = AdminLocation.visibleLevels(field.adminLevels, configured),
            labels = configured.orEmpty().mapNotNull { c -> c.label(language)?.let { c.level to it } }.toMap(),
        )
    }

    /** Admin levels of a country: API (cached to Room), Room when offline. */
    private suspend fun loadAdminLevels(countryCode: String) {
        if (_uiState.value.adminLevelsByCountry.containsKey(countryCode)) return
        val cacheType = "admin-levels:$countryCode"
        val namesSerializer = MapSerializer(String.serializer(), String.serializer())
        val remote = withTimeoutOrNull(ADMIN_API_TIMEOUT_MS) { campaignApi.getAdminLevels(countryCode) }
        val levels = if (remote != null) {
            refDataCacheDao.deleteByType(cacheType)
            refDataCacheDao.upsertAll(remote.map { l ->
                RefDataCacheEntity(
                    type = cacheType, itemId = l.level.toString(),
                    label = adminJson.encodeToString(namesSerializer, l.names),
                    parentId = if (l.isActive) "active" else "inactive", sortOrder = l.level,
                )
            })
            remote
        } else {
            refDataCacheDao.getByType(cacheType).mapNotNull { c ->
                val level = c.itemId.toIntOrNull() ?: return@mapNotNull null
                val names = try { adminJson.decodeFromString(namesSerializer, c.label) } catch (_: Exception) { emptyMap() }
                AdminLevelConfig(level, names, isActive = c.parentId != "inactive")
            }.takeIf { it.isNotEmpty() }
        }
        Log.d(TAG, "Admin levels $countryCode: ${levels?.size ?: "unknown"} (remote=${remote != null})")
        // Unknown (offline and never cached): keep the form's levels; not remembered so it is retried
        if (levels != null) {
            _uiState.value = _uiState.value.copy(
                adminLevelsByCountry = _uiState.value.adminLevelsByCountry + (countryCode to levels),
            )
        }
    }

    /**
     * Children of a geo unit: API first (fresh, active divisions only) refreshing the Room cache,
     * Room when offline. For level 2, falls back to all ADMIN2 of the country (broken parentId data).
     */
    private suspend fun loadGeoChildren(parentId: String, level: Int, countryId: String?): List<SelectOption> {
        val remote = withTimeoutOrNull(ADMIN_API_TIMEOUT_MS) { campaignApi.getGeoChildren(parentId) }
        if (!remote.isNullOrEmpty()) {
            val now = System.currentTimeMillis()
            geoDao.upsertAll(remote.map { GeoEntity(it.id, it.displayLabel(), "ADMIN$level", parentId, it.code, now) })
            geoDao.deleteChildrenNotIn(parentId, remote.map { it.id })
            return remote.map { SelectOption(it.id, it.displayLabel()) }.sortedBy { it.label }
        }
        val cached = geoDao.getChildren(parentId).map { SelectOption(it.id, it.name) }
        if (cached.isNotEmpty() || remote == null) return cached
        if (level == 2 && countryId != null) {
            val all = withTimeoutOrNull(ADMIN_API_TIMEOUT_MS) { campaignApi.getGeoUnits("ADMIN2", countryId) }.orEmpty()
            return all.map { SelectOption(it.id, it.displayLabel()) }.sortedBy { it.label }
        }
        return emptyList()
    }

    private suspend fun loadCountries(): List<SelectOption> {
        // Try Room first (offline-first approach — geo data is bulk-synced)
        // Option value = ISO code (same as web level_0); children are looked up via countryIdByCode
        val local = geoDao.getByLevel("COUNTRY").filter { !it.isoCode.isNullOrBlank() }
        if (local.isNotEmpty()) {
            countryIdByCode = local.associate { it.isoCode!!.uppercase() to it.id }
            Log.d(TAG, "Countries from Room: ${local.size}")
            return local.map { SelectOption(value = it.isoCode!!.uppercase(), label = it.name) }
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
                val withCode = items.filter { !it.code.isNullOrBlank() }
                countryIdByCode = withCode.associate { it.code!!.uppercase() to it.id }
                Log.d(TAG, "Countries from API: ${items.size} (cached to Room)")
                return withCode.map { SelectOption(value = it.code!!.uppercase(), label = it.displayLabel()) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Countries API failed: ${e.message}")
        }
        return emptyList()
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
                data = buildDataJson(state),
                gpsLat = state.gpsLat, gpsLng = state.gpsLng, gpsAccuracy = state.gpsAccuracy,
            )
            _events.emit(FormEvent.DraftSaved)
        }
    }

    fun submit() {
        viewModelScope.launch {
            val state = _uiState.value
            val validationErrors = validator.validate(state.fields, state.values) { adminFieldView(it, state).levels }
            if (validationErrors.isNotEmpty()) {
                _uiState.value = state.copy(errors = validationErrors.associate { it.field to it.message })
                return@launch
            }
            submissionRepository.submitForm(
                id = state.submissionId, tenantId = tokenManager.tenantId ?: "",
                campaignId = campaignId, templateId = state.templateId,
                data = buildDataJson(state),
                gpsLat = state.gpsLat, gpsLng = state.gpsLng, gpsAccuracy = state.gpsAccuracy,
            )
            _events.emit(FormEvent.Submitted)
        }
    }

    /**
     * Flat values as strings; each admin-location field as `{ level_0: "BI", level_1: "<uuid>", ... }`
     * (same shape as the web), limited to the levels shown for the selected country.
     */
    private fun buildDataJson(state: FormFillUiState): String {
        val adminFields = state.fields.filter { it.type == FormFieldType.ADMIN_CASCADER }
        val adminKeys = adminFields.map { it.key }.toSet()
        val entries = mutableMapOf<String, JsonElement>()
        state.values.forEach { (k, v) ->
            if (!k.startsWith("_") && AdminLocation.parseKey(k)?.first !in adminKeys) entries[k] = JsonPrimitive(v)
        }
        adminFields.forEach { f ->
            AdminLocation.toJson(f.key, state.values, adminFieldView(f, state).levels)?.let { entries[f.key] = it }
        }
        return JsonObject(entries).toString()
    }
}
