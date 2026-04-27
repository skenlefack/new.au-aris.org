package org.auibar.aris.mobile.data.repository

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import org.auibar.aris.mobile.data.local.dao.ReportDao
import org.auibar.aris.mobile.data.local.entity.ReportEntity
import org.auibar.aris.mobile.data.remote.api.ReportApi
import timber.log.Timber
import java.io.File
import javax.inject.Inject

class ReportRepository @Inject constructor(
    private val reportDao: ReportDao,
    private val reportApi: ReportApi,
    @ApplicationContext private val context: Context,
) {
    fun observePublished(): Flow<List<ReportEntity>> = reportDao.observePublished()

    fun observeByDomain(domainCode: String): Flow<List<ReportEntity>> =
        reportDao.observeByDomain(domainCode)

    fun observeById(id: String): Flow<ReportEntity?> = reportDao.observeById(id)

    suspend fun refreshReports(domainCode: String? = null): Result<Unit> {
        return try {
            val response = reportApi.listPublished(domainCode)
            val now = System.currentTimeMillis()
            val entities = response.data.map { dto ->
                val existing = reportDao.getById(dto.id)
                ReportEntity(
                    id = dto.id,
                    templateCode = dto.templateCode,
                    type = dto.type,
                    status = dto.status,
                    titleFr = dto.titleFr,
                    titleEn = dto.titleEn,
                    themeFr = dto.themeFr,
                    themeEn = dto.themeEn,
                    periodStart = dto.periodStart,
                    periodEnd = dto.periodEnd,
                    referenceYear = dto.referenceYear,
                    scope = dto.scope,
                    domainCode = dto.domainCode,
                    subDomainCode = dto.subDomainCode,
                    countryCode = dto.countryCode,
                    recCode = dto.recCode,
                    pdfRemoteUrl = dto.pdfRemoteUrl,
                    pdfSizeBytes = dto.pdfSizeBytes,
                    publishedAt = dto.publishedAt,
                    // Preserve local download state
                    pdfLocalPath = existing?.pdfLocalPath,
                    pdfDownloadStatus = existing?.pdfDownloadStatus ?: "NOT_DOWNLOADED",
                    syncedAt = now,
                )
            }
            reportDao.upsertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh reports")
            Result.failure(e)
        }
    }

    suspend fun downloadPdf(report: ReportEntity): Result<String> {
        val url = report.pdfRemoteUrl ?: return Result.failure(IllegalStateException("No PDF URL"))
        val maxSize = 10L * 1024 * 1024
        if (report.pdfSizeBytes != null && report.pdfSizeBytes > maxSize) {
            return Result.failure(IllegalStateException("PDF too large (>${maxSize / 1024 / 1024}MB)"))
        }

        reportDao.updateDownloadStatus(report.id, "DOWNLOADING", null)
        val targetFile = File(context.filesDir, "reports/${report.id}.pdf")

        return try {
            val result = reportApi.downloadPdf(url, targetFile)
            if (result.isSuccess) {
                reportDao.updateDownloadStatus(report.id, "DOWNLOADED", targetFile.absolutePath)
                Result.success(targetFile.absolutePath)
            } else {
                reportDao.updateDownloadStatus(report.id, "FAILED", null)
                Result.failure(result.exceptionOrNull() ?: Exception("Download failed"))
            }
        } catch (e: Exception) {
            reportDao.updateDownloadStatus(report.id, "FAILED", null)
            Timber.e(e, "Failed to download PDF for report ${report.id}")
            Result.failure(e)
        }
    }
}
