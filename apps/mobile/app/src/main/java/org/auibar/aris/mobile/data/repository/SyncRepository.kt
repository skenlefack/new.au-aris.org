package org.auibar.aris.mobile.data.repository

import org.auibar.aris.mobile.data.local.dao.CampaignDao
import org.auibar.aris.mobile.data.local.dao.DiseaseDao
import org.auibar.aris.mobile.data.local.dao.FormTemplateDao
import org.auibar.aris.mobile.data.local.dao.GeoDao
import org.auibar.aris.mobile.data.local.dao.SpeciesDao
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.CampaignEntity
import org.auibar.aris.mobile.data.local.entity.DiseaseEntity
import org.auibar.aris.mobile.data.local.entity.FormTemplateEntity
import org.auibar.aris.mobile.data.local.entity.GeoEntity
import org.auibar.aris.mobile.data.local.entity.SpeciesEntity
import org.auibar.aris.mobile.data.remote.api.SyncApi
import org.auibar.aris.mobile.data.remote.dto.SubmissionDto
import org.auibar.aris.mobile.data.remote.dto.SyncRequest
import org.auibar.aris.mobile.util.TokenManager
import javax.inject.Inject

class SyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val submissionDao: SubmissionDao,
    private val campaignDao: CampaignDao,
    private val formTemplateDao: FormTemplateDao,
    private val speciesDao: SpeciesDao,
    private val diseaseDao: DiseaseDao,
    private val geoDao: GeoDao,
    private val tokenManager: TokenManager,
) {
    suspend fun performSync(): Result<SyncResult> {
        return try {
            val pendingSubmissions = submissionDao.getPendingSync()
            val submissionDtos = pendingSubmissions.map { entity ->
                SubmissionDto(
                    id = entity.id,
                    tenantId = entity.tenantId,
                    campaignId = entity.campaignId,
                    templateId = entity.templateId,
                    data = entity.data,
                    gpsLat = entity.gpsLat,
                    gpsLng = entity.gpsLng,
                    gpsAccuracy = entity.gpsAccuracy,
                    offlineCreatedAt = entity.offlineCreatedAt,
                )
            }

            val response = syncApi.sync(
                SyncRequest(
                    submissions = submissionDtos,
                    lastSyncAt = tokenManager.lastSyncAt,
                )
            )

            val syncData = response.data
            val now = System.currentTimeMillis()

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

            // Update campaigns
            if (syncData.updatedCampaigns.isNotEmpty()) {
                val entities = syncData.updatedCampaigns.map { dto ->
                    CampaignEntity(
                        id = dto.id,
                        tenantId = dto.tenantId,
                        name = dto.name,
                        domain = dto.domain,
                        templateId = dto.templateId,
                        startDate = dto.startDate,
                        endDate = dto.endDate,
                        status = dto.status,
                        syncedAt = now,
                    )
                }
                campaignDao.upsertAll(entities)
            }

            // Update form templates
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
            }

            // Update referentials
            val refs = syncData.updatedReferentials
            if (refs.species.isNotEmpty()) {
                speciesDao.upsertAll(refs.species.map { dto ->
                    SpeciesEntity(
                        id = dto.id,
                        commonName = dto.commonName,
                        scientificName = dto.scientificName,
                        category = dto.category,
                        syncedAt = now,
                    )
                })
            }
            if (refs.diseases.isNotEmpty()) {
                diseaseDao.upsertAll(refs.diseases.map { dto ->
                    DiseaseEntity(
                        id = dto.id,
                        name = dto.name,
                        woahCode = dto.woahCode,
                        category = dto.category,
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

            tokenManager.lastSyncAt = now

            Result.success(
                SyncResult(
                    accepted = syncData.accepted.size,
                    rejected = syncData.rejected.size,
                    conflicts = syncData.conflicts.size,
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

data class SyncResult(
    val accepted: Int,
    val rejected: Int,
    val conflicts: Int,
)
