package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.auibar.aris.mobile.data.local.dao.SubmissionDao
import org.auibar.aris.mobile.data.local.entity.SubmissionEntity
import javax.inject.Inject

data class Submission(
    val id: String,
    val campaignId: String,
    val templateId: String,
    val data: String,
    val gpsLat: Double?,
    val gpsLng: Double?,
    val offlineCreatedAt: Long,
    val syncStatus: String,
    val serverErrors: String?,
)

class SubmissionRepository @Inject constructor(
    private val submissionDao: SubmissionDao,
) {
    fun getAll(): Flow<List<Submission>> {
        return submissionDao.getAll().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getByCampaign(campaignId: String): Flow<List<Submission>> {
        return submissionDao.getByCampaign(campaignId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getPendingCount(): Flow<Int> = submissionDao.getPendingCount()

    suspend fun createSubmission(
        id: String,
        tenantId: String,
        campaignId: String,
        templateId: String,
        data: String,
        gpsLat: Double?,
        gpsLng: Double?,
        gpsAccuracy: Float?,
    ) {
        val entity = SubmissionEntity(
            id = id,
            tenantId = tenantId,
            campaignId = campaignId,
            templateId = templateId,
            data = data,
            gpsLat = gpsLat,
            gpsLng = gpsLng,
            gpsAccuracy = gpsAccuracy,
            offlineCreatedAt = System.currentTimeMillis(),
            syncedAt = null,
            syncStatus = "PENDING",
            serverErrors = null,
        )
        submissionDao.insert(entity)
    }

    private fun SubmissionEntity.toDomain() = Submission(
        id = id,
        campaignId = campaignId,
        templateId = templateId,
        data = data,
        gpsLat = gpsLat,
        gpsLng = gpsLng,
        offlineCreatedAt = offlineCreatedAt,
        syncStatus = syncStatus,
        serverErrors = serverErrors,
    )
}
