package org.auibar.aris.mobile.ui.conflict

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
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import javax.inject.Inject

data class FieldDiff(
    val key: String,
    val localValue: String,
    val serverValue: String,
    val isDifferent: Boolean,
    val useLocal: Boolean = true,
)

data class ConflictUiState(
    val isLoading: Boolean = true,
    val submissionId: String = "",
    val campaignId: String = "",
    val offlineCreatedAt: Long = 0L,
    val fields: List<FieldDiff> = emptyList(),
    val diffCount: Int = 0,
    val showConfirmDialog: ConfirmAction? = null,
)

enum class ConfirmAction { KEEP_LOCAL, ACCEPT_SERVER, DISCARD }

sealed class ConflictEvent {
    data object Resolved : ConflictEvent()
    data object Discarded : ConflictEvent()
    data class Error(val message: String) : ConflictEvent()
}

@HiltViewModel
class ConflictResolutionViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val submissionRepository: SubmissionRepository,
) : ViewModel() {

    private val submissionId: String = savedStateHandle["submissionId"] ?: ""

    private val _state = MutableStateFlow(ConflictUiState())
    val state: StateFlow<ConflictUiState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<ConflictEvent>()
    val events = _events.asSharedFlow()

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    init {
        loadConflict()
    }

    private fun loadConflict() {
        viewModelScope.launch {
            val submission = submissionRepository.getById(submissionId)
            if (submission == null || submission.syncStatus != "CONFLICT") {
                _events.emit(ConflictEvent.Error("Submission not found or not in conflict"))
                return@launch
            }

            val localData = parseJson(submission.data)
            val serverData = parseJson(submission.serverData ?: "{}")

            val allKeys = (localData.keys + serverData.keys).toSortedSet()
            val fields = allKeys.map { key ->
                val localVal = localData[key]?.asString() ?: ""
                val serverVal = serverData[key]?.asString() ?: ""
                FieldDiff(
                    key = key,
                    localValue = localVal,
                    serverValue = serverVal,
                    isDifferent = localVal != serverVal,
                )
            }

            _state.value = ConflictUiState(
                isLoading = false,
                submissionId = submissionId,
                campaignId = submission.campaignId,
                offlineCreatedAt = submission.offlineCreatedAt,
                fields = fields,
                diffCount = fields.count { it.isDifferent },
            )
        }
    }

    fun toggleFieldChoice(key: String) {
        _state.value = _state.value.copy(
            fields = _state.value.fields.map { field ->
                if (field.key == key && field.isDifferent) {
                    field.copy(useLocal = !field.useLocal)
                } else {
                    field
                }
            },
        )
    }

    fun selectAllLocal() {
        _state.value = _state.value.copy(
            fields = _state.value.fields.map { it.copy(useLocal = true) },
        )
    }

    fun selectAllServer() {
        _state.value = _state.value.copy(
            fields = _state.value.fields.map { it.copy(useLocal = false) },
        )
    }

    fun showConfirmDialog(action: ConfirmAction) {
        _state.value = _state.value.copy(showConfirmDialog = action)
    }

    fun dismissConfirmDialog() {
        _state.value = _state.value.copy(showConfirmDialog = null)
    }

    fun confirmAction() {
        val action = _state.value.showConfirmDialog ?: return
        dismissConfirmDialog()
        when (action) {
            ConfirmAction.KEEP_LOCAL -> resolveKeepLocal()
            ConfirmAction.ACCEPT_SERVER -> resolveAcceptServer()
            ConfirmAction.DISCARD -> discard()
        }
    }

    fun resolveMerged() {
        viewModelScope.launch {
            val merged = buildMergedJson()
            submissionRepository.resolveConflict(submissionId, merged)
            _events.emit(ConflictEvent.Resolved)
        }
    }

    private fun resolveKeepLocal() {
        viewModelScope.launch {
            val submission = submissionRepository.getById(submissionId)
            if (submission != null) {
                submissionRepository.resolveConflict(submissionId, submission.data)
                _events.emit(ConflictEvent.Resolved)
            }
        }
    }

    private fun resolveAcceptServer() {
        viewModelScope.launch {
            val submission = submissionRepository.getById(submissionId)
            if (submission?.serverData != null) {
                submissionRepository.resolveConflict(submissionId, submission.serverData)
                _events.emit(ConflictEvent.Resolved)
            }
        }
    }

    private fun discard() {
        viewModelScope.launch {
            submissionRepository.discardConflict(submissionId)
            _events.emit(ConflictEvent.Discarded)
        }
    }

    private fun buildMergedJson(): String {
        val fields = _state.value.fields
        val merged = mutableMapOf<String, String>()
        fields.forEach { field ->
            val value = if (field.useLocal) field.localValue else field.serverValue
            merged[field.key] = value
        }
        val jsonObj = JsonObject(merged.mapValues { JsonPrimitive(it.value) })
        return json.encodeToString(JsonObject.serializer(), jsonObj)
    }

    private fun parseJson(raw: String): Map<String, JsonPrimitive> {
        return try {
            val obj = json.parseToJsonElement(raw).jsonObject
            obj.mapValues { (_, v) ->
                if (v is JsonPrimitive) v
                else JsonPrimitive(v.toString())
            }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun JsonPrimitive.asString(): String {
        return if (isString) content else toString()
    }
}
