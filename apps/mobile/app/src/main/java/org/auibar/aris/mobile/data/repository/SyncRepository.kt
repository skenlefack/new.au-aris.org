package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.CampaignTargetDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateTargetDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.mapper.TargetMapper
import org.auibar.aris.mobile.BuildConfig
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.data.remote.dto.SubmissionDto
import org.auibar.aris.mobile.data.remote.dto.SyncRequest
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

class SyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val submissionDao: SubmissionDao,
    private val campaignDao: CampaignDao,
    private val campaignTargetDao: CampaignTargetDao,
    private val formTemplateDao: FormTemplateDao,
    private val formTemplateTargetDao: FormTemplateTargetDao,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val tokenManager: TokenManager,
) {
    companion object {
        const val BATCH_SIZE = 10
        private const val CLEANUP_DAYS = 30
    }

    /** Clean up old synced submissions (>30 days). Called from CacheRefreshWorker. */
    suspend fun cleanupOldSubmissions() {
        val cutoff = System.currentTimeMillis() - CLEANUP_DAYS.toLong() * 24 * 60 * 60 * 1000
        submissionDao.deleteSyncedOlderThan(cutoff)
    }

    suspend fun performSync(): Result<SyncResult> {
        return try {
            val pendingSubmissions = submissionDao.getPendingSync()
            // Paginate: send in batches of BATCH_SIZE to avoid timeout on degraded networks
            val batches = pendingSubmissions.chunked(BATCH_SIZE)

            var totalAccepted = 0
            var totalRejected = 0
            var totalConflicts = 0

            for (batch in batches) {
                val submissionDtos = batch.map { entity ->
                    SubmissionDto(
                        id = entity.id,
                        tenantId = entity.tenantId,
                        campaignId = entity.campaignId,
                        templateId = entity.templateId,
                        data = entity.data,
                        domain = entity.domain,
                        gpsLat = entity.gpsLat,
                        gpsLng = entity.gpsLng,
                        gpsAccuracy = entity.gpsAccuracy,
                        offlineCreatedAt = entity.offlineCreatedAt,
                    )
                }

                val response = try {
                    syncApi.sync(
                        SyncRequest(
                            submissions = submissionDtos,
                            lastSyncAt = tokenManager.lastSyncAt,
                            deviceId = tokenManager.deviceId,
                            clientVersion = BuildConfig.VERSION_NAME,
                        )
                    )
                } catch (e: Exception) {
                    // If a batch fails, stop and retry remaining on next run
                    break
                }

                val syncData = response.data
                val now = System.currentTimeMillis()

                processSyncResponse(syncData, now)

                totalAccepted += syncData.accepted.size
                totalRejected += syncData.rejected.size
                totalConflicts += syncData.conflicts.size
            }

            tokenManager.lastSyncAt = System.currentTimeMillis()

            Result.success(
                SyncResult(
                    accepted = totalAccepted,
                    rejected = totalRejected,
                    conflicts = totalConflicts,
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun processSyncResponse(
        syncData: org.auibar.aris.mobile.data.remote.dto.SyncResponse,
        now: Long,
    ) {
        // Mark accepted submissions
        syncData.accepted.forEach { id ->
            submissionDao.updateSyncStatus(id, "SYNCED", now)
        }

        // Mark rejected submissions
        syncData.rejected.forEach { rejected ->
            submissionDao.updateSyncError(
                rejected.id,
                "FAILED",
                rejected.errors.joinToString("; "),
            )
        }

        // Mark conflicts with server version data
        syncData.conflicts.forEach { conflict ->
            submissionDao.markConflict(conflict.id, conflict.serverVersion)
        }

        // Update campaigns + their targets
        if (syncData.updatedCampaigns.isNotEmpty()) {
            val entities = syncData.updatedCampaigns.map { it.toEntity(now) }
            campaignDao.upsertAll(entities)
            syncData.updatedCampaigns.forEach { dto ->
                val targets = TargetMapper.campaignTargetsFromDto(dto, now)
                campaignTargetDao.replaceForCampaign(dto.id, targets)
            }
        }

        // Update form templates + their targets
        if (syncData.updatedTemplates.isNotEmpty()) {
            val entities = syncData.updatedTemplates.map { dto ->
                FormTemplateEntity(
                    id = dto.id,
                    name = dto.name,
                    domain = dto.domain,
                    schema = dto.schema,
                    uiSchema = dto.uiSchema,
                    version = dto.version,
                    syncedAt = now,
                )
            }
            formTemplateDao.upsertAll(entities)
            syncData.updatedTemplates.forEach { dto ->
                val targets = TargetMapper.templateTargetsFromDto(dto, now)
                formTemplateTargetDao.replaceForTemplate(dto.id, targets)
            }
        }

        // Update referentials
        val refs = syncData.updatedReferentials
        if (refs.species.isNotEmpty()) {
            speciesDao.upsertAll(refs.species.map { dto ->
                SpeciesEntity(
                    id = dto.id,
                    commonName = dto.resolvedName,
                    scientificName = dto.scientificName ?: "",
                    category = dto.category ?: "OTHER",
                    syncedAt = now,
                )
            })
        }
        if (refs.diseases.isNotEmpty()) {
            diseaseDao.upsertAll(refs.diseases.map { dto ->
                DiseaseEntity(
                    id = dto.id,
                    name = dto.resolvedName,
                    woahCode = dto.woahCode,
                    category = dto.category ?: "OTHER",
                    isNotifiable = dto.isNotifiable,
                    syncedAt = now,
                )
            })
        }
        if (refs.geoUnits.isNotEmpty()) {
            geoDao.upsertAll(refs.geoUnits.map { dto ->
                GeoEntity(
                    id = dto.id,
                    name = dto.name,
                    level = dto.level,
                    parentId = dto.parentId,
                    isoCode = dto.isoCode,
                    syncedAt = now,
                )
            })
        }

        // Update workflow statuses
        syncData.workflowUpdates.forEach { wf ->
            submissionDao.updateWorkflow(wf.submissionId, wf.level, wf.status)
        }

        // Update quality gate results
        syncData.qualityResults.forEach { qr ->
            submissionDao.updateQualityResults(qr.submissionId, qr.results)
        }
    }
}

data class SyncResult(
    val accepted: Int,
    val rejected: Int,
    val conflicts: Int,
)
