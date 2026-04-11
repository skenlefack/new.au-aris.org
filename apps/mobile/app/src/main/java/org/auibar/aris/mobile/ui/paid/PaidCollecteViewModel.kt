package org.auibar.aris.mobile.ui.paid

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.repository.FormTemplateRepository
import javax.inject.Inject

data class PaidCollecteUiState(
    val templates: List<FormTemplateEntity> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PaidCollecteViewModel @Inject constructor(
    private val formTemplateRepository: FormTemplateRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PaidCollecteUiState(isLoading = true))
    val uiState: StateFlow<PaidCollecteUiState> = _uiState.asStateFlow()

    init {
        loadTemplates()
    }

    private fun loadTemplates() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                formTemplateRepository.getTemplatesByDomain("paid").collect { templates ->
                    _uiState.value = PaidCollecteUiState(
                        templates = templates,
                        isLoading = false,
                    )
                }
            } catch (e: Exception) {
                _uiState.value = PaidCollecteUiState(
                    isLoading = false,
                    error = e.message,
                )
            }
        }
    }

    fun refresh() {
        loadTemplates()
    }
}
