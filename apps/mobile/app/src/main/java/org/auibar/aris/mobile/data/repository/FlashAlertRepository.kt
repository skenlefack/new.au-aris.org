package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.dao.FlashAlertDao
import org.auibar.aris.mobile.data.local.entity.FlashAlertEntity
import javax.inject.Inject

class FlashAlertRepository @Inject constructor(
    private val flashAlertDao: FlashAlertDao,
) {
    fun observeAll(): Flow<List<FlashAlertEntity>> = flashAlertDao.observeAll()

    fun observeUnread(): Flow<List<FlashAlertEntity>> = flashAlertDao.observeUnread()

    fun observeUnreadCount(): Flow<Int> = flashAlertDao.observeUnreadCount()

    suspend fun upsert(alert: FlashAlertEntity) = flashAlertDao.upsert(alert)

    suspend fun markAsRead(id: String) = flashAlertDao.markAsRead(id)

    suspend fun markAllAsRead() = flashAlertDao.markAllAsRead()

    suspend fun cleanup(maxAgeDays: Int = 90) {
        val cutoff = System.currentTimeMillis() - maxAgeDays.toLong() * 24 * 60 * 60 * 1000
        flashAlertDao.deleteOlderThan(cutoff)
    }
}
