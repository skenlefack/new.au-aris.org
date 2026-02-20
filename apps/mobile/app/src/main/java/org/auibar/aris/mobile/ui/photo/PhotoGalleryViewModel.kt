package org.auibar.aris.mobile.ui.photo

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import org.auibar.aris.mobile.data.repository.PhotoRepository
import javax.inject.Inject

@HiltViewModel
class PhotoGalleryViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    photoRepository: PhotoRepository,
) : ViewModel() {
    private val submissionId: String = savedStateHandle.get<String>("submissionId") ?: ""

    val photos = photoRepository.getBySubmission(submissionId)
}
