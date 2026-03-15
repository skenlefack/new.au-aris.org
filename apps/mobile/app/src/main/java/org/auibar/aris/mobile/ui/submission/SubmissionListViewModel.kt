package org.auibar.aris.mobile.ui.submission

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import javax.inject.Inject

data class SubmissionFilter(
    val query: String = "",
    val statusFilter: String? = null,
    val domainFilter: String? = null,
    val dateFromMs: Long? = null,
    val dateToMs: Long? = null,
) {
    val isActive: Boolean
        get() = query.isNotBlank() || statusFilter != null || domainFilter != null ||
                dateFromMs != null || dateToMs != null
}

data class SubmissionListUiState(
    val allSubmissions: List<Submission> = emptyList(),
    val filteredSubmissions: List<Submission> = emptyList(),
    val filter: SubmissionFilter = SubmissionFilter(),
    val availableStatuses: List<String> = emptyList(),
    val availableDomains: List<String> = emptyList(),
)

@HiltViewModel
class SubmissionListViewModel @Inject constructor(
    submissionRepository: SubmissionRepository,
) : ViewModel() {

    private val _filter = MutableStateFlow(SubmissionFilter())

    val uiState: StateFlow<SubmissionListUiState> = combine(
        submissionRepository.getAll(),
        _filter,
    ) { submissions, filter ->
        val statuses = submissions.map { it.syncStatus }.distinct().sorted()
        val domains = submissions.mapNotNull { it.domain }.distinct().sorted()

        val filtered = submissions.filter { sub ->
            matchesQuery(sub, filter.query) &&
                    matchesStatus(sub, filter.statusFilter) &&
                    matchesDomain(sub, filter.domainFilter) &&
                    matchesDateRange(sub, filter.dateFromMs, filter.dateToMs)
        }

        SubmissionListUiState(
            allSubmissions = submissions,
            filteredSubmissions = filtered,
            filter = filter,
            availableStatuses = statuses,
            availableDomains = domains,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SubmissionListUiState())

    fun setQuery(query: String) {
        _filter.value = _filter.value.copy(query = query)
    }

    fun setStatusFilter(status: String?) {
        _filter.value = _filter.value.copy(statusFilter = status)
    }

    fun setDomainFilter(domain: String?) {
        _filter.value = _filter.value.copy(domainFilter = domain)
    }

    fun setDateRange(fromMs: Long?, toMs: Long?) {
        _filter.value = _filter.value.copy(dateFromMs = fromMs, dateToMs = toMs)
    }

    fun clearFilters() {
        _filter.value = SubmissionFilter()
    }

    private fun matchesQuery(sub: Submission, query: String): Boolean {
        if (query.isBlank()) return true
        val q = query.lowercase()
        return sub.campaignId.lowercase().contains(q) ||
                sub.id.lowercase().contains(q) ||
                sub.data.lowercase().contains(q) ||
                (sub.domain?.lowercase()?.contains(q) == true)
    }

    private fun matchesStatus(sub: Submission, status: String?): Boolean {
        if (status == null) return true
        return sub.syncStatus == status
    }

    private fun matchesDomain(sub: Submission, domain: String?): Boolean {
        if (domain == null) return true
        return sub.domain == domain
    }

    private fun matchesDateRange(sub: Submission, fromMs: Long?, toMs: Long?): Boolean {
        if (fromMs != null && sub.offlineCreatedAt < fromMs) return false
        if (toMs != null && sub.offlineCreatedAt > toMs) return false
        return true
    }
}
