package org.auibar.aris.mobile.ui.photo

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.repository.Photo
import org.auibar.aris.mobile.data.repository.PhotoRepository
import org.auibar.aris.mobile.sync.PhotoUploadWorker
import org.auibar.aris.mobile.util.PhotoCompressor
import java.io.File
import java.util.UUID
import javax.inject.Inject

data class PhotoGalleryUiState(
    val isCompressing: Boolean = false,
    val uploadSummary: String = "",
)

@HiltViewModel
class PhotoGalleryViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val photoRepository: PhotoRepository,
    private val photoCompressor: PhotoCompressor,
) : ViewModel() {

    private val submissionId: String = savedStateHandle["submissionId"] ?: ""

    val photos: Flow<List<Photo>> = photoRepository.getBySubmission(submissionId)

    private val _uiState = MutableStateFlow(PhotoGalleryUiState())
    val uiState: StateFlow<PhotoGalleryUiState> = _uiState.asStateFlow()

    /**
     * Process a captured photo: compress, store metadata, and enqueue upload.
     */
    fun addCapturedPhoto(uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = _uiState.value.copy(isCompressing = true)
            try {
                val photosDir = File(context.cacheDir, "photos")
                photosDir.mkdirs()
                val originalFile = File(photosDir, "orig_${UUID.randomUUID()}.jpg")
                context.contentResolver.openInputStream(uri)?.use { input ->
                    originalFile.outputStream().use { output -> input.copyTo(output) }
                }

                val originalSize = originalFile.length()
                val compressResult = photoCompressor.compress(originalFile.absolutePath)
                val finalPath = compressResult.filePath
                val compressedSize = compressResult.sizeBytes
                val gps = photoCompressor.extractGpsFromExif(finalPath)

                photoRepository.addPhoto(
                    submissionId = submissionId,
                    filePath = finalPath,
                    thumbnailPath = null,
                    originalSizeBytes = originalSize,
                    compressedSizeBytes = compressedSize,
                    gpsLat = gps?.first,
                    gpsLng = gps?.second,
                )

                PhotoUploadWorker.enqueue(context)

                _uiState.value = _uiState.value.copy(
                    isCompressing = false,
                    uploadSummary = "Photo added (${formatSize(compressedSize)})",
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isCompressing = false,
                    uploadSummary = "Failed: ${e.message}",
                )
            }
        }
    }

    fun retryFailed() {
        viewModelScope.launch {
            PhotoUploadWorker.enqueue(context)
            _uiState.value = _uiState.value.copy(uploadSummary = "Retry queued")
        }
    }

    fun deletePhoto(photoId: String) {
        viewModelScope.launch {
            photoRepository.deletePhoto(photoId)
        }
    }

    private fun formatSize(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> "${bytes / (1024 * 1024)} MB"
    }
}
