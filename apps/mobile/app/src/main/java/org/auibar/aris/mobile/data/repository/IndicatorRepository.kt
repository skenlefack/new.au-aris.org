package org.auibar.aris.mobile.data.repository

import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.dao.IndicatorDao
import org.auibar.aris.mobile.data.local.dao.IndicatorValueDao
import org.auibar.aris.mobile.data.local.entity.IndicatorEntity
import org.auibar.aris.mobile.data.local.entity.IndicatorValueEntity
import org.auibar.aris.mobile.data.remote.api.IndicatorApi
import timber.log.Timber
import javax.inject.Inject

class IndicatorRepository @Inject constructor(
    private val indicatorDao: IndicatorDao,
    private val indicatorValueDao: IndicatorValueDao,
    private val indicatorApi: IndicatorApi,
) {
    fun observeAll(): Flow<List<IndicatorEntity>> = indicatorDao.observeAll()

    fun observeByDomain(domainCode: String): Flow<List<IndicatorEntity>> =
        indicatorDao.observeByDomain(domainCode)

    fun observeById(id: String): Flow<IndicatorEntity?> = indicatorDao.observeById(id)

    fun observeValues(indicatorId: String, limit: Int = 24): Flow<List<IndicatorValueEntity>> =
        indicatorValueDao.observeRecent(indicatorId, limit)

    suspend fun refreshIndicators(domainCode: String? = null): Result<Unit> {
        return try {
            val response = indicatorApi.list(domainCode)
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                IndicatorEntity(
                    id = dto.id,
                    code = dto.code,
                    nameFr = dto.nameFr,
                    nameEn = dto.nameEn,
                    nameAr = dto.nameAr,
                    namePt = dto.namePt,
                    descriptionFr = dto.descriptionFr,
                    descriptionEn = dto.descriptionEn,
                    typeCode = dto.typeCode,
                    domainCode = dto.domainCode,
                    subDomainCode = dto.subDomainCode,
                    unit = dto.unit,
                    decimalPlaces = dto.decimalPlaces,
                    targetValue = dto.targetValue,
                    betterIsHigher = dto.betterIsHigher,
                    measurementMode = dto.measurementMode,
                    formulaExpression = dto.formulaExpression,
                    lastValue = dto.lastValue,
                    lastValueAt = dto.lastValueAt,
                    previousValue = dto.previousValue,
                    trend = dto.trend,
                    active = dto.active,
                    syncedAt = now,
                )
            }
            indicatorDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh indicators")
            Result.failure(e)
        }
    }

    suspend fun refreshValues(indicatorCode: String, indicatorId: String): Result<Unit> {
        return try {
            val response = indicatorApi.getValues(indicatorCode)
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                IndicatorValueEntity(
                    id = dto.id,
                    indicatorId = dto.indicatorId,
                    year = dto.year,
                    month = dto.month,
                    quarter = dto.quarter,
                    countryCode = dto.countryCode,
                    recCode = dto.recCode,
                    isContinental = dto.isContinental,
                    value = dto.value,
                    source = dto.source,
                    syncedAt = now,
                )
            }
            indicatorValueDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh indicator values for $indicatorCode")
            Result.failure(e)
        }
    }
}
