package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.dao.FlashAlertDao
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity
import org.auibar.aris.mobile.data.remote.api.FlashAlertApi
import timber.log.Timber
import javax.inject.Inject

class FlashAlertRepository @Inject constructor(
    private val flashAlertDao: FlashAlertDao,
    private val flashAlertApi: FlashAlertApi,
) {
    fun observeAll(): Flow<List<FlashAlertEntity>> = flashAlertDao.observeAll()

    fun observeUnread(): Flow<List<FlashAlertEntity>> = flashAlertDao.observeUnread()

    fun observeUnreadCount(): Flow<Int> = flashAlertDao.observeUnreadCount()

    suspend fun upsert(alert: FlashAlertEntity) = flashAlertDao.upsert(alert)

    suspend fun markAsRead(id: String) = flashAlertDao.markAsRead(id)

    suspend fun markAllAsRead() = flashAlertDao.markAllAsRead()

    /** Pull latest flash alerts from REST API (fallback when WebSocket is unavailable). */
    suspend fun refreshFromApi(): Result<Unit> {
        return try {
            val response = flashAlertApi.list()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                FlashAlertEntity(
                    id = dto.id,
                    alertCode = dto.alertCode,
                    severity = dto.severity,
                    sourceType = dto.sourceType,
                    sourceId = dto.sourceId,
                    countryCode = dto.countryCode,
                    recCode = dto.recCode,
                    domainCode = dto.domainCode,
                    subDomainCode = dto.subDomainCode,
                    titleFr = dto.titleFr,
                    titleEn = dto.titleEn,
                    detectedAt = dto.detectedAt,
                    triggerDataJson = dto.triggerDataJson,
                    status = dto.status,
                    relatedReportId = dto.relatedReportId,
                    syncedAt = now,
                )
            }
            flashAlertDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh flash alerts from API")
            Result.failure(e)
        }
    }

    suspend fun cleanup(maxAgeDays: Int = 90) {
        val cutoff = System.currentTimeMillis() - maxAgeDays.toLong() * 24 * 60 * 60 * 1000
        flashAlertDao.deleteOlderThan(cutoff)
    }
}
