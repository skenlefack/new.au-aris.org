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
class ReportDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val reportRepository: ReportRepository,
) : ViewModel() {

    private val reportId: String = savedStateHandle["reportId"] ?: ""

    val report: StateFlow<ReportEntity?> = reportRepository
        .observeById(reportId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _isDownloading = MutableStateFlow(false)
    val isDownloading: StateFlow<Boolean> = _isDownloading.asStateFlow()

    fun downloadPdf() {
        val rpt = report.value ?: return
        viewModelScope.launch {
            _isDownloading.value = true
            reportRepository.downloadPdf(rpt)
            _isDownloading.value = false
        }
    }
}
