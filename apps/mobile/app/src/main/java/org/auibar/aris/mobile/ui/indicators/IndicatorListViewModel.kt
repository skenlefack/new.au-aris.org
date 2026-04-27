package org.auibar.aris.mobile.ui.indicators

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
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.repository.IndicatorRepository
import javax.inject.Inject

@HiltViewModel
class IndicatorListViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val indicatorRepository: IndicatorRepository,
) : ViewModel() {

    private val domainCode: String? = savedStateHandle["domainCode"]

    val indicators: StateFlow<List<IndicatorEntity>> = if (domainCode != null) {
        indicatorRepository.observeByDomain(domainCode)
    } else {
        indicatorRepository.observeAll()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            indicatorRepository.refreshIndicators(domainCode)
            _isLoading.value = false
        }
    }
}
