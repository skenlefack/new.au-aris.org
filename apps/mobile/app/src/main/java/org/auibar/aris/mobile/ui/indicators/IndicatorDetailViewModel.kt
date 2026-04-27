package org.auibar.aris.mobile.ui.indicators

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.local.entity.IndicatorValueEntity
import org.auibar.aris.mobile.data.repository.IndicatorRepository
import javax.inject.Inject

@HiltViewModel
class IndicatorDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val indicatorRepository: IndicatorRepository,
) : ViewModel() {

    private val indicatorId: String = savedStateHandle["indicatorId"] ?: ""

    val indicator: StateFlow<IndicatorEntity?> = indicatorRepository
        .observeById(indicatorId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val values: StateFlow<List<IndicatorValueEntity>> = indicatorRepository
        .observeValues(indicatorId, 24)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        refreshValues()
    }

    fun refreshValues() {
        viewModelScope.launch {
            val ind = indicatorRepository.observeById(indicatorId)
            // Get the code from the entity to call the API
            val entity = indicator.value
            if (entity != null) {
                indicatorRepository.refreshValues(entity.code, entity.id)
            }
        }
    }
}
