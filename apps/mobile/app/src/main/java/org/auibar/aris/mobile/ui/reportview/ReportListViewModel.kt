package org.auibar.aris.mobile.ui.reportview

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.ReportEntity
import org.auibar.aris.mobile.data.repository.ReportRepository
import javax.inject.Inject

@HiltViewModel
class ReportListViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val reportRepository: ReportRepository,
) : ViewModel() {

    private val domainCode: String? = savedStateHandle["domainCode"]

    val reports: StateFlow<List<ReportEntity>> = if (domainCode != null) {
        reportRepository.observeByDomain(domainCode)
    } else {
        reportRepository.observePublished()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            reportRepository.refreshReports(domainCode)
            _isLoading.value = false
        }
    }
}
