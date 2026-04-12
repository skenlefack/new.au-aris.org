package org.auibar.aris.mobile.ui.map

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TileDownloadViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val tileManager = MapTileManager(context)

    private val _selectedSource = MutableStateFlow(tileManager.getSavedTileSource())
    val selectedSource: StateFlow<MapTileManager.MapTileSource> = _selectedSource.asStateFlow()

    private val _cacheSize = MutableStateFlow(0L)
    val cacheSize: StateFlow<Long> = _cacheSize.asStateFlow()

    private val _tileCount = MutableStateFlow(0)
    val tileCount: StateFlow<Int> = _tileCount.asStateFlow()

    private val _isDownloading = MutableStateFlow(false)
    val isDownloading: StateFlow<Boolean> = _isDownloading.asStateFlow()

    private val _downloadProgress = MutableStateFlow(0f)
    val downloadProgress: StateFlow<Float> = _downloadProgress.asStateFlow()

    private val _downloadedTiles = MutableStateFlow(0)
    val downloadedTiles: StateFlow<Int> = _downloadedTiles.asStateFlow()

    private val _totalTiles = MutableStateFlow(0)
    val totalTiles: StateFlow<Int> = _totalTiles.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var downloadJob: Job? = null

    init {
        refreshCacheStats()
    }

    fun selectSource(source: MapTileManager.MapTileSource) {
        _selectedSource.value = source
        tileManager.saveTileSource(source)
    }

    fun downloadPreset(preset: MapTileManager.RegionPreset) {
        if (_isDownloading.value) return

        val estimate = tileManager.estimatePreset(
            preset = preset,
            tileSource = _selectedSource.value,
        )
        _totalTiles.value = estimate.totalTiles
        _downloadedTiles.value = 0
        _downloadProgress.value = 0f
        _isDownloading.value = true
        _error.value = null

        downloadJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                val result = tileManager.downloadRegionPreset(
                    preset = preset,
                    tileSource = _selectedSource.value,
                ) { downloaded, total ->
                    _downloadedTiles.value = downloaded
                    _totalTiles.value = total
                    _downloadProgress.value = if (total > 0) downloaded.toFloat() / total else 0f
                }

                if (result.error != null) {
                    _error.value = result.error
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Download failed"
            } finally {
                _isDownloading.value = false
                refreshCacheStats()
            }
        }
    }

    fun cancelDownload() {
        downloadJob?.cancel()
        downloadJob = null
        _isDownloading.value = false
        _downloadProgress.value = 0f
        refreshCacheStats()
    }

    fun pruneExpired() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                tileManager.pruneExpiredTiles()
                refreshCacheStats()
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun clearCache() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                tileManager.clearTileCache()
                refreshCacheStats()
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun refreshCacheStats() {
        viewModelScope.launch(Dispatchers.IO) {
            _cacheSize.value = tileManager.getTileCacheSize()
            _tileCount.value = tileManager.getTileCount()
        }
    }

    fun getEstimateForPreset(preset: MapTileManager.RegionPreset): MapTileManager.TileEstimate {
        return tileManager.estimatePreset(
            preset = preset,
            tileSource = _selectedSource.value,
        )
    }
}
