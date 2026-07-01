package org.auibar.aris.mobile.ui.analytics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.remote.api.AnalyticsApi
import org.auibar.aris.mobile.data.remote.dto.CountryBeneficiaries
import org.auibar.aris.mobile.data.remote.dto.DomainSubmissionCount
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.data.remote.dto.TimelinePoint
import org.auibar.aris.mobile.data.repository.DashboardRepository
import javax.inject.Inject

@HiltViewModel
class AnalyticsDashboardViewModel @Inject constructor(
    private val analyticsApi: AnalyticsApi,
    private val dashboardRepository: DashboardRepository,
) : ViewModel() {

    private val _kpis = MutableStateFlow<List<KpiCard>>(emptyList())
    val kpis: StateFlow<List<KpiCard>> = _kpis.asStateFlow()

    private val _submissionsByDomain = MutableStateFlow<List<DomainSubmissionCount>>(emptyList())
    val submissionsByDomain: StateFlow<List<DomainSubmissionCount>> = _submissionsByDomain.asStateFlow()

    private val _timeline = MutableStateFlow<List<TimelinePoint>>(emptyList())
    val timeline: StateFlow<List<TimelinePoint>> = _timeline.asStateFlow()

    private val _beneficiariesByCountry = MutableStateFlow<List<CountryBeneficiaries>>(emptyList())
    val beneficiariesByCountry: StateFlow<List<CountryBeneficiaries>> = _beneficiariesByCountry.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _timelinePeriod = MutableStateFlow("monthly")
    val timelinePeriod: StateFlow<String> = _timelinePeriod.asStateFlow()

    init {
        loadAll()
    }

    fun refresh() {
        loadAll()
    }

    fun setTimelinePeriod(period: String) {
        _timelinePeriod.value = period
        viewModelScope.launch {
            try {
                val response = analyticsApi.getSubmissionsTimeline(period)
                _timeline.value = response.data?.points ?: emptyList()
            } catch (e: Exception) {
                // Keep existing timeline data on period switch failure
            }
        }
    }

    private fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            try {
                val kpiDeferred = async {
                    dashboardRepository.getContinentalKpis(forceRefresh = true)
                }
                val domainDeferred = async {
                    analyticsApi.getSubmissionsByDomain()
                }
                val timelineDeferred = async {
                    analyticsApi.getSubmissionsTimeline(_timelinePeriod.value)
                }
                val beneficiariesDeferred = async {
                    analyticsApi.getBeneficiariesByCountry()
                }

                val kpiResult = kpiDeferred.await()
                kpiResult.onSuccess { _kpis.value = it }
                kpiResult.onFailure { _error.value = it.message }

                try {
                    _submissionsByDomain.value = domainDeferred.await().data?.items ?: emptyList()
                } catch (e: Exception) {
                    if (_error.value == null) _error.value = e.message
                }

                try {
                    _timeline.value = timelineDeferred.await().data?.points ?: emptyList()
                } catch (e: Exception) {
                    if (_error.value == null) _error.value = e.message
                }

                try {
                    _beneficiariesByCountry.value = beneficiariesDeferred.await().data?.items ?: emptyList()
                } catch (e: Exception) {
                    if (_error.value == null) _error.value = e.message
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load analytics data"
            } finally {
                _isLoading.value = false
            }
        }
    }
}
