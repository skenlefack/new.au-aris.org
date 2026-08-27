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

            // Brief delay to ensure auth tokens are loaded by Ktor bearer plugin
            kotlinx.coroutines.delay(500)

            // Step 0: Geo (paginated — backend MAX_LIMIT=100)
            updateStep(0, StepStatus.IN_PROGRESS)
            try {
                val allGeo = syncApi.fetchAllGeoUnits()
                val now = System.currentTimeMillis()
                val entities = allGeo.map { dto ->
                    GeoEntity(
                        id = dto.id,
                        name = dto.resolvedName,
                        level = dto.level,
                        parentId = dto.parentId,
                        isoCode = dto.isoCode ?: dto.countryCode,
                        syncedAt = now,
                    )
                }
                geoDao.upsertAll(entities)
                cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_GEO)
                updateStep(0, StepStatus.DONE, entities.size)
                completedCount++
                Log.d(TAG, "Geo synced: ${entities.size}")
            } catch (e: Exception) {
                updateStep(0, StepStatus.ERROR, errorMessage = e.message?.take(60) ?: "Network error")
                Log.w(TAG, "Geo sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 1: Species (paginated — backend MAX_LIMIT=100)
            updateStep(1, StepStatus.IN_PROGRESS)
            try {
                val allSpecies = syncApi.fetchAllSpecies()
                val now = System.currentTimeMillis()
                val entities = allSpecies.map { dto ->
                    SpeciesEntity(
                        id = dto.id,
                        commonName = dto.resolvedName,
                        scientificName = dto.scientificName ?: "",
                        category = dto.category ?: "OTHER",
                        syncedAt = now,
                    )
                }
                speciesDao.upsertAll(entities)
                cachePolicy.markRefreshed(CachePolicy.KEY_MASTER_SPECIES)
                updateStep(1, StepStatus.DONE, entities.size)
                completedCount++
                Log.d(TAG, "Species synced: ${entities.size}")
            } catch (e: Exception) {
                updateStep(1, StepStatus.ERROR, errorMessage = e.message?.take(60) ?: "Network error")
                Log.w(TAG, "Species sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 2: Diseases (paginated — backend MAX_LIMIT=100)
            updateStep(2, StepStatus.IN_PROGRESS)
            try {
                val allDiseases = syncApi.fetchAllDiseases()
                val now = System.currentTimeMillis()
                val entities = allDiseases.map { dto ->
                    DiseaseEntity(
                        id = dto.id,
                        name = dto.resolvedName,
                        woahCode = dto.woahCode,
                        category = dto.category ?: "OTHER",
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
                updateStep(2, StepStatus.ERROR, errorMessage = e.message?.take(60) ?: "Network error")
                Log.w(TAG, "Diseases sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 3: Campaigns (list only, no ref data)
            updateStep(3, StepStatus.IN_PROGRESS)
            try {
                campaignRefresher.forceRefresh()
                val campaignCount = try { formTemplateDao.getAllIds().size } catch (_: Exception) { 0 }
                updateStep(3, StepStatus.DONE, campaignCount)
                completedCount++
                Log.d(TAG, "Campaigns synced")
            } catch (e: Exception) {
                updateStep(3, StepStatus.ERROR, errorMessage = e.message?.take(80) ?: "Network error")
                Log.w(TAG, "Campaigns sync failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 4: Templates (count what was fetched by campaignRefresher)
            updateStep(4, StepStatus.IN_PROGRESS)
            try {
                val templateCount = try { formTemplateDao.getAll().size } catch (_: Exception) { 0 }
                updateStep(4, StepStatus.DONE, templateCount)
                completedCount++
                Log.d(TAG, "Templates: $templateCount cached")
            } catch (e: Exception) {
                updateStep(4, StepStatus.ERROR, errorMessage = e.message?.take(80) ?: "Error")
                Log.w(TAG, "Templates check failed", e)
            }
            updateProgress(completedCount, totalSteps)

            // Step 5: Reference Data
            // Ref data for form selects is cached on-demand when user opens a form.
            // We just count what's already available from species + diseases synced above.
            updateStep(5, StepStatus.IN_PROGRESS)
            try {
                val refCount = try {
                    speciesDao.getAll().size + diseaseDao.getAll().size
                } catch (_: Exception) { 0 }
                updateStep(5, StepStatus.DONE, refCount)
                completedCount++
                Log.d(TAG, "Ref data ready: $refCount base items (custom types cached on form open)")
            } catch (e: Exception) {
                updateStep(5, StepStatus.DONE, 0)
                completedCount++
            }
            updateProgress(completedCount, totalSteps)

            // Step 6: Dashboard & KPIs (with 10s timeout to avoid blocking)
            updateStep(6, StepStatus.IN_PROGRESS)
            try {
                val kpiResult = kotlinx.coroutines.withTimeoutOrNull(10_000L) {
                    val result = dashboardRepository.getKpis(forceRefresh = true)
                    val kpiCount = result.getOrNull()?.size ?: 0
                    val continentalResult = dashboardRepository.getContinentalKpis(forceRefresh = true)
                    kpiCount + (continentalResult.getOrNull()?.size ?: 0)
                }
                updateStep(6, StepStatus.DONE, kpiResult ?: 0)
                completedCount++
                Log.d(TAG, "Dashboard KPIs synced: ${kpiResult ?: 0}")
            } catch (e: Exception) {
                // Dashboard is non-critical — mark as done with 0 to not block sync
                updateStep(6, StepStatus.DONE, 0)
                completedCount++
                Log.w(TAG, "Dashboard sync skipped: ${e.message}")
            }
            updateProgress(completedCount, totalSteps)

            // Mark initial sync as done (dedicated flag, not affected by background workers)
            cachePolicy.markInitialSyncDone()
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
