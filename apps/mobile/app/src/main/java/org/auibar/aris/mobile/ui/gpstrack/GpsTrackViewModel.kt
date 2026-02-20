package org.auibar.aris.mobile.ui.gpstrack

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.repository.GpsTrackRepository
import org.auibar.aris.mobile.service.GpsTrackingService
import javax.inject.Inject

@HiltViewModel
class GpsTrackViewModel @Inject constructor(
    private val gpsTrackRepository: GpsTrackRepository,
) : ViewModel() {

    val activeTrack = gpsTrackRepository.observeActiveTrack()
    val allTracks = gpsTrackRepository.getAll()

    fun startTracking(context: Context, campaignId: String?) {
        viewModelScope.launch {
            val trackId = gpsTrackRepository.startTrack(campaignId)
            GpsTrackingService.start(context, trackId)
        }
    }

    fun stopTracking(context: Context) {
        GpsTrackingService.stop(context)
    }
}
