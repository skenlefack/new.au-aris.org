package org.auibar.aris.mobile.ui.sync

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.data.cache.CachePolicy
import org.auibar.aris.mobile.data.cache.CampaignRefresher
import org.auibar.aris.mobile.data.cache.MasterDataRefresher
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.RefDataCacheDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.data.repository.DashboardRepository
import javax.inject.Inject

enum class StepStatus { WAITING, IN_PROGRESS, DONE, ERROR }

data class SyncStep(
    val name: String,
    val status: StepStatus = StepStatus.WAITING,
    val count: Int = 0,
    val errorMessage: String? = null,
)

data class SyncState(
    val steps: List<SyncStep> = emptyList(),
    val currentStepIndex: Int = -1,
    val isComplete: Boolean = false,
    val overallProgress: Float = 0f,
)

@HiltViewModel
class InitialSyncViewModel @Inject constructor(
    private val syncApi: SyncApi,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val formTemplateDao: FormTemplateDao,
    private val refDataCacheDao: RefDataCacheDao,
    private val campaignRefresher: CampaignRefresher,
    private val masterDataRefresher: MasterDataRefresher,
    private val dashboardRepository: DashboardRepository,
    private val cachePolicy: CachePolicy,
) : ViewModel() {

    companion object {
        private const val TAG = "InitialSync"
    }

    private val _state = MutableStateFlow(
        SyncState(
            steps = listOf(
                SyncStep("geo"),
                SyncStep("species"),
                SyncStep("diseases"),
                SyncStep("campaigns"),
                SyncStep("templates"),
                SyncStep("refdata"),
                SyncStep("dashboard"),
            ),
        ),
    )
    val state: StateFlow<SyncState> = _state.asStateFlow()

    fun isInitialSyncNeeded(): Boolean {
        return cachePolicy.getLastRefresh(CachePolicy.KEY_MASTER_GEO) == 0L
    }

    fun startSync() {
        viewModelScope.launch {
            val totalSteps = _state.value.steps.size
            var completedCount = 0

            // Step 0: Geo
            updateStep(0, StepStatus.IN_PROGRESS)
            try {
                val response = syncApi.fetchGeoUnits()
                val now = System.currentTimeMillis()
                val entities = response.data.map { dto ->
                    GeoEntity(
                        id = dto.id,
                        name = dto.name,
                        level = dto.level,
                        parentId = dto.parentId,
                        isoCode = dto.isoCode,
                        syncedAt = now,
                    )
                }
                geoDao.upsertAll(entities)
                cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_GEO)
                updateStep(0, StepStatus.DONE, entities.size)
                completedCount++
                Log.d(TAG, "Geo synced: ${entities.size}")
            } catch (e: Exception) {
                updateStep(0, StepStatus.ERROR, errorMessage = e.message ?: "Network error")
                Log.w(TAG, "Geo sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 1: Species
            updateStep(1, StepStatus.IN_PROGRESS)
            try {
                val response = syncApi.fetchSpecies()
                val now = System.currentTimeMillis()
                val entities = response.data.map { dto ->
                    SpeciesEntity(
                        id = dto.id,
                        commonName = dto.commonName,
                        scientificName = dto.scientificName,
                        category = dto.category,
                        syncedAt = now,
                    )
                }
                speciesDao.upsertAll(entities)
                cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_SPECIES)
                updateStep(1, StepStatus.DONE, entities.size)
                completedCount++
                Log.d(TAG, "Species synced: ${entities.size}")
            } catch (e: Exception) {
                updateStep(1, StepStatus.ERROR, errorMessage = e.message ?: "Network error")
                Log.w(TAG, "Species sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 2: Diseases
            updateStep(2, StepStatus.IN_PROGRESS)
            try {
                val response = syncApi.fetchDiseases()
                val now = System.currentTimeMillis()
                val entities = response.data.map { dto ->
                    DiseaseEntity(
                        id = dto.id,
                        name = dto.name,
                        woahCode = dto.woahCode,
                        category = dto.category,
                        isNotifiable = dto.isNotifiable,
                        syncedAt = now,
                    )
                }
                diseaseDao.upsertAll(entities)
                cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_DISEASES)
                updateStep(2, StepStatus.DONE, entities.size)
                completedCount++
                Log.d(TAG, "Diseases synced: ${entities.size}")
            } catch (e: Exception) {
                updateStep(2, StepStatus.ERROR, errorMessage = e.message ?: "Network error")
                Log.w(TAG, "Diseases sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 3: Campaigns
            updateStep(3, StepStatus.IN_PROGRESS)
            try {
                campaignRefresher.forceRefresh()
                val templateCount = formTemplateDao.getAllIds().size
                updateStep(3, StepStatus.DONE, templateCount)
                completedCount++
                Log.d(TAG, "Campaigns synced")
            } catch (e: Exception) {
                updateStep(3, StepStatus.ERROR, errorMessage = e.message ?: "Network error")
                Log.w(TAG, "Campaigns sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 4: Templates (already fetched by campaignRefresher)
            updateStep(4, StepStatus.IN_PROGRESS)
            try {
                val templateCount = formTemplateDao.getAll().size
                updateStep(4, StepStatus.DONE, templateCount)
                completedCount++
                Log.d(TAG, "Templates: $templateCount cached")
            } catch (e: Exception) {
                updateStep(4, StepStatus.ERROR, errorMessage = e.message ?: "Error")
                Log.w(TAG, "Templates check failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 5: Reference Data
            updateStep(5, StepStatus.IN_PROGRESS)
            try {
                masterDataRefresher.forceRefreshAll()
                // Count total cached ref data items across all types
                val allTemplates = formTemplateDao.getAll()
                var refCount = 0
                for (t in allTemplates) {
                    refCount += refDataCacheDao.getByType(t.domain).size
                }
                // If refCount is 0, try species+diseases+geo as fallback count
                if (refCount == 0) {
                    refCount = speciesDao.getAll().size + diseaseDao.getAll().size
                }
                updateStep(5, StepStatus.DONE, refCount)
                completedCount++
                Log.d(TAG, "Ref data synced: $refCount items")
            } catch (e: Exception) {
                updateStep(5, StepStatus.ERROR, errorMessage = e.message ?: "Network error")
                Log.w(TAG, "Ref data sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 6: Dashboard & KPIs
            updateStep(6, StepStatus.IN_PROGRESS)
            try {
                val result = dashboardRepository.getKpis(forceRefresh = true)
                val kpiCount = result.getOrNull()?.size ?: 0
                // Also try continental KPIs
                val continentalResult = dashboardRepository.getContinentalKpis(forceRefresh = true)
                val totalKpis = kpiCount + (continentalResult.getOrNull()?.size ?: 0)
                updateStep(6, StepStatus.DONE, totalKpis)
                completedCount++
                Log.d(TAG, "Dashboard KPIs synced: $totalKpis")
            } catch (e: Exception) {
                updateStep(6, StepStatus.ERROR, errorMessage = e.message ?: "Network error")
                Log.w(TAG, "Dashboard sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Mark complete
            _state.update { it.copy(isComplete = true, overallProgress = 1f) }
        }
    }

    private fun updateStep(
        index: Int,
        status: StepStatus,
        count: Int = 0,
        errorMessage: String? = null,
    ) {
        _state.update { current ->
            val newSteps = current.steps.toMutableList()
            newSteps[index] = newSteps[index].copy(
                status = status,
                count = count,
                errorMessage = errorMessage,
            )
            current.copy(
                steps = newSteps,
                currentStepIndex = index,
            )
        }
    }

    private fun updateProgress(completed: Int, total: Int) {
        _state.update { it.copy(overallProgress = completed.toFloat() / total.toFloat()) }
    }
}
