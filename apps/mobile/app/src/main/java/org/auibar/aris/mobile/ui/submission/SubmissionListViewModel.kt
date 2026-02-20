package org.auibar.aris.mobile.ui.submission

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import org.auibar.aris.mobile.data.repository.Submission
import org.auibar.aris.mobile.data.repository.SubmissionRepository
import javax.inject.Inject

@HiltViewModel
class SubmissionListViewModel @Inject constructor(
    submissionRepository: SubmissionRepository,
) : ViewModel() {

    val submissions: StateFlow<List<Submission>> = submissionRepository
        .getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}
