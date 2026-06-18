package org.auibar.aris.mobile.ui.validation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.api.ValidationItemDto
import org.auibar.aris.mobile.data.repository.ValidationRepository
import javax.inject.Inject

data class ValidationUiState(
    val items: List<ValidationItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val isError: Boolean = false,
    val errorMessage: String? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    // Filters
    val levelFilter: String? = null,
    val statusFilter: String? = null,
    val entityTypeFilter: String? = null,
    val searchQuery: String = "",
    // KPIs
    val pendingCount: Int = 0,
    val approvedThisWeek: Int = 0,
    // Action state
    val confirmingAction: ConfirmingAction? = null,
    val actionComments: Map<String, String> = emptyMap(),
    val isPerformingAction: Boolean = false,
)

data class ConfirmingAction(
    val id: String,
    val action: String, // "approve", "reject", "return", "validate_submission", "reject_submission"
)

private const val PAGE_SIZE = 10

@HiltViewModel
class ValidationListViewModel @Inject constructor(
    private val repository: ValidationRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ValidationUiState())
    val uiState: StateFlow<ValidationUiState> = _uiState.asStateFlow()

    init {
        loadValidations()
    }

    fun loadValidations() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, isError = false) }
            val result = repository.getValidations(
                page = state.page,
                limit = PAGE_SIZE,
                level = state.levelFilter,
                status = state.statusFilter,
                entityType = state.entityTypeFilter,
            )
            result.fold(
                onSuccess = { data ->
                    val total = data.meta?.total ?: data.items.size
                    val pending = data.items.count { it.status.equals("PENDING", ignoreCase = true) }
                    val weekAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000
                    val approved = data.items.count { item ->
                        item.status.equals("APPROVED", ignoreCase = true) && parseIsoToMillis(item.createdAt) >= weekAgo
                    }
                    _uiState.update {
                        it.copy(
                            items = data.items,
                            isLoading = false,
                            total = total,
                            totalPages = maxOf(1, (total + PAGE_SIZE - 1) / PAGE_SIZE),
                            pendingCount = pending,
                            approvedThisWeek = approved,
                        )
                    }
                },
                onFailure = { e ->
                    _uiState.update {
                        it.copy(isLoading = false, isError = true, errorMessage = e.message)
                    }
                },
            )
        }
    }

    fun setLevelFilter(level: String?) {
        _uiState.update { it.copy(levelFilter = level, page = 1) }
        loadValidations()
    }

    fun setStatusFilter(status: String?) {
        _uiState.update { it.copy(statusFilter = status, page = 1) }
        loadValidations()
    }

    fun setEntityTypeFilter(type: String?) {
        _uiState.update { it.copy(entityTypeFilter = type, page = 1) }
        loadValidations()
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query, page = 1) }
    }

    fun nextPage() {
        val state = _uiState.value
        if (state.page < state.totalPages) {
            _uiState.update { it.copy(page = it.page + 1) }
            loadValidations()
        }
    }

    fun previousPage() {
        val state = _uiState.value
        if (state.page > 1) {
            _uiState.update { it.copy(page = it.page - 1) }
            loadValidations()
        }
    }

    fun startConfirming(id: String, action: String) {
        _uiState.update { it.copy(confirmingAction = ConfirmingAction(id, action)) }
    }

    fun cancelConfirming() {
        _uiState.update { it.copy(confirmingAction = null) }
    }

    fun setActionComment(id: String, comment: String) {
        _uiState.update { it.copy(actionComments = it.actionComments + (id to comment)) }
    }

    fun performAction() {
        val state = _uiState.value
        val confirming = state.confirmingAction ?: return
        val comment = state.actionComments[confirming.id]

        viewModelScope.launch {
            _uiState.update { it.copy(isPerformingAction = true) }
            val success = when (confirming.action) {
                "approve" -> repository.approve(confirming.id, comment)
                "reject" -> repository.reject(confirming.id, comment ?: "", comment)
                "return" -> repository.returnItem(confirming.id, comment ?: "", comment)
                "validate_submission" -> repository.validateSubmission(confirming.id, comment)
                "reject_submission" -> repository.rejectSubmission(confirming.id, comment ?: "")
                else -> false
            }
            if (success) {
                _uiState.update {
                    it.copy(
                        confirmingAction = null,
                        isPerformingAction = false,
                        actionComments = it.actionComments - confirming.id,
                    )
                }
                loadValidations()
            } else {
                _uiState.update { it.copy(isPerformingAction = false) }
            }
        }
    }

    private fun parseIsoToMillis(iso: String): Long {
        return try {
            java.time.Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) {
            0L
        }
    }
}
