package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.dao.DashboardDao
import org.auibar.aris.mobile.data.local.dao.DashboardWidgetDao
import org.auibar.aris.mobile.data.local.entity.DashboardEntity
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity
import org.auibar.aris.mobile.data.remote.api.DashboardMobileApi
import timber.log.Timber
import javax.inject.Inject

class DashboardMobileRepository @Inject constructor(
    private val dashboardDao: DashboardDao,
    private val widgetDao: DashboardWidgetDao,
    private val dashboardApi: DashboardMobileApi,
) {
    fun observeAll(): Flow<List<DashboardEntity>> = dashboardDao.observeAll()

    fun observeByScope(scope: String): Flow<List<DashboardEntity>> =
        dashboardDao.observeByScope(scope)

    fun observeByCampaignId(campaignId: String): Flow<List<DashboardEntity>> =
        dashboardDao.observeByCampaignId(campaignId)

    fun observeById(id: String): Flow<DashboardEntity?> = dashboardDao.observeById(id)

    fun observeWidgets(dashboardId: String): Flow<List<DashboardWidgetEntity>> =
        widgetDao.observeForDashboard(dashboardId)

    suspend fun refreshDashboards(): Result<Unit> {
        return try {
            val response = dashboardApi.listAccessible()
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                DashboardEntity(
                    id = dto.id,
                    ownership = dto.ownership,
                    scope = dto.scope,
                    domainCode = dto.domainCode,
                    subDomainCode = dto.subDomainCode,
                    titleFr = dto.titleFr,
                    titleEn = dto.titleEn,
                    titleAr = dto.titleAr,
                    titlePt = dto.titlePt,
                    description = dto.description,
                    gridColumns = dto.gridColumns,
                    rowHeight = dto.rowHeight,
                    ownerUserId = dto.ownerUserId,
                    isDefault = dto.isDefault,
                    campaignId = dto.campaignId,
                    syncedAt = now,
                )
            }
            dashboardDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh dashboards")
            Result.failure(e)
        }
    }

    suspend fun refreshDashboardsForCampaign(campaignId: String): Result<Unit> {
        return try {
            val response = dashboardApi.listAccessible(campaignId = campaignId)
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                DashboardEntity(
                    id = dto.id,
                    ownership = dto.ownership,
                    scope = dto.scope,
                    domainCode = dto.domainCode,
                    subDomainCode = dto.subDomainCode,
                    titleFr = dto.titleFr,
                    titleEn = dto.titleEn,
                    titleAr = dto.titleAr,
                    titlePt = dto.titlePt,
                    description = dto.description,
                    gridColumns = dto.gridColumns,
                    rowHeight = dto.rowHeight,
                    ownerUserId = dto.ownerUserId,
                    isDefault = dto.isDefault,
                    campaignId = dto.campaignId,
                    syncedAt = now,
                )
            }
            dashboardDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh dashboards for campaign $campaignId")
            Result.failure(e)
        }
    }

    suspend fun renderAndCache(dashboardId: String): Result<List<DashboardWidgetEntity>> {
        return try {
            val response = dashboardApi.render(dashboardId)
            val rendered = response.data
            val now = System.currentTimeMillis()

            val widgetEntities = rendered.widgets.map { w ->
                DashboardWidgetEntity(
                    id = w.id,
                    dashboardId = w.dashboardId,
                    type = w.type,
                    dataSource = w.dataSource,
                    gridX = w.gridX,
                    gridY = w.gridY,
                    gridW = w.gridW,
                    gridH = w.gridH,
                    titleFr = w.titleFr,
                    titleEn = w.titleEn,
                    configJson = w.configJson,
                    syncedAt = now,
                )
            }

            widgetDao.deleteForDashboard(dashboardId)
            widgetDao.upsertAll(widgetEntities)

            // Cache snapshot timestamp
            dashboardDao.updateSnapshot(dashboardId, "{}", now)

            Result.success(widgetEntities)
        } catch (e: Exception) {
            Timber.e(e, "Failed to render dashboard $dashboardId")
            Result.failure(e)
        }
    }
}
