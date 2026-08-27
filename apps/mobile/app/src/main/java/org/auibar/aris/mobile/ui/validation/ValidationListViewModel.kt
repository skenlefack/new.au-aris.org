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
import org.auibar.aris.mobile.data.remote.dto.WorkflowDashboardDto
import org.auibar.aris.mobile.data.repository.ValidationRepository
import javax.inject.Inject

/** Tab definitions matching web (To Validate, Rejected, Returned, Validated). */
enum class ValidationTab(val statuses: List<String>) {
    TO_VALIDATE(listOf("PENDING", "SUBMITTED", "IN_REVIEW", "ESCALATED")),
    REJECTED(listOf("REJECTED")),
    RETURNED(listOf("RETURNED")),
    VALIDATED(listOf("VALIDATED", "APPROVED")),
}

data class ValidationUiState(
    val items: List<ValidationItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val isError: Boolean = false,
    val errorMessage: String? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    // Tabs
    val activeTab: ValidationTab = ValidationTab.TO_VALIDATE,
    val tabCounts: Map<ValidationTab, Int> = emptyMap(),
    // Filters
    val levelFilter: String? = null,
    val entityTypeFilter: String? = null,
    val searchQuery: String = "",
    // Dashboard KPIs (server-driven)
    val dashboard: WorkflowDashboardDto? = null,
    // Selection for bulk actions
    val selectedIds: Set<String> = emptySet(),
    val isBulkActioning: Boolean = false,
    val bulkResultMessage: String? = null,
    // Action state
    val confirmingAction: ConfirmingAction? = null,
    val actionComments: Map<String, String> = emptyMap(),
    val isPerformingAction: Boolean = false,
)

data class ConfirmingAction(
    val id: String,
    val action: String,
)

private const val PAGE_SIZE = 20

@HiltViewModel
class ValidationListViewModel @Inject constructor(
    private val repository: ValidationRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ValidationUiState())
    val uiState: StateFlow<ValidationUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
        loadValidations()
    }

    /** Fetch real KPIs from /api/v1/workflow/dashboard. */
    private fun loadDashboard() {
        viewModelScope.launch {
            val dashboard = repository.getDashboardMetrics()
            if (dashboard != null) {
                _uiState.update {
                    it.copy(
                        dashboard = dashboard,
                        tabCounts = mapOf(
                            ValidationTab.TO_VALIDATE to (dashboard.totalPending + dashboard.totalInReview + dashboard.totalEscalated),
                            ValidationTab.REJECTED to dashboard.totalRejected,
                            ValidationTab.RETURNED to 0, // Server may not have this separate
                            ValidationTab.VALIDATED to dashboard.totalApproved,
                        ),
                    )
                }
            }
        }
    }

    fun loadValidations() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, isError = false, selectedIds = emptySet()) }
            val result = repository.getValidations(
                page = state.page,
                limit = PAGE_SIZE,
                level = state.levelFilter,
                status = state.activeTab.statuses.firstOrNull(),
                entityType = null,
                campaignId = null,
            )
            result.fold(
                onSuccess = { data ->
                    val total = data.meta?.total ?: data.items.size
                    _uiState.update {
                        it.copy(
                            items = data.items,
                            isLoading = false,
                            total = total,
                            totalPages = maxOf(1, (total + PAGE_SIZE - 1) / PAGE_SIZE),
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

    fun setActiveTab(tab: ValidationTab) {
        _uiState.update { it.copy(activeTab = tab, page = 1) }
        loadValidations()
    }

    fun setLevelFilter(level: String?) {
        _uiState.update { it.copy(levelFilter = level, page = 1) }
        loadValidations()
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query, page = 1) }
        // Search is local filter only for now
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

    // ── Selection for bulk actions ──

    fun toggleSelection(id: String) {
        _uiState.update {
            val newSet = it.selectedIds.toMutableSet()
            if (id in newSet) newSet.remove(id) else newSet.add(id)
            it.copy(selectedIds = newSet)
        }
    }

    fun selectAll() {
        _uiState.update { it.copy(selectedIds = it.items.map { item -> item.id }.toSet()) }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedIds = emptySet(), bulkResultMessage = null) }
    }

    fun bulkAction(action: String, comment: String? = null) {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isBulkActioning = true) }
            val result = repository.bulkAction(ids, action, comment)
            val msg = if (result != null) {
                "${result.succeeded.size} OK, ${result.failed.size} failed"
            } else {
                "Bulk action failed"
            }
            _uiState.update {
                it.copy(isBulkActioning = false, selectedIds = emptySet(), bulkResultMessage = msg)
            }
            loadDashboard()
            loadValidations()
        }
    }

    fun dismissBulkMessage() {
        _uiState.update { it.copy(bulkResultMessage = null) }
    }

    // ── Single item actions ──

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
                "comment" -> repository.comment(confirming.id, comment ?: "")
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
                loadDashboard()
                loadValidations()
            } else {
                _uiState.update { it.copy(isPerformingAction = false) }
            }
        }
    }
}
