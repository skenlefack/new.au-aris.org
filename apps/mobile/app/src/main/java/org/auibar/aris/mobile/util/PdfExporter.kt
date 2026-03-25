package org.auibar.aris.mobile.util

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.data.repository.Submission
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object PdfExporter {

    private const val PAGE_WIDTH = 595  // A4 in points (72 dpi)
    private const val PAGE_HEIGHT = 842
    private const val MARGIN = 40f
    private const val LINE_HEIGHT = 18f

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /**
     * Export a single submission to PDF with metadata, form data, quality gates, and workflow.
     */
    fun exportSubmission(context: Context, submission: Submission): File? {
        return try {
            val document = PdfDocument()
            var pageNumber = 1
            var pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
            var page = document.startPage(pageInfo)
            var canvas = page.canvas
            var yPos = MARGIN

            val titlePaint = createPaint(Color.rgb(27, 94, 32), 20f, bold = true)
            val headerPaint = createPaint(Color.rgb(27, 94, 32), 14f, bold = true)
            val labelPaint = createPaint(Color.DKGRAY, 11f, bold = true)
            val valuePaint = createPaint(Color.BLACK, 11f)
            val metaPaint = createPaint(Color.GRAY, 9f)
            val linePaint = Paint().apply { color = Color.LTGRAY; strokeWidth = 1f }
            val passedPaint = createPaint(Color.rgb(46, 125, 50), 11f)
            val failedPaint = createPaint(Color.rgb(198, 40, 40), 11f)

            // Title
            canvas.drawText("ARIS - Submission Report", MARGIN, yPos + 20f, titlePaint)
            yPos += 35f
            canvas.drawLine(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos, linePaint)
            yPos += 15f

            // Metadata section
            val dateFormat = SimpleDateFormat("dd MMM yyyy HH:mm:ss", Locale.getDefault())
            canvas.drawText("Metadata", MARGIN, yPos, headerPaint)
            yPos += LINE_HEIGHT

            val metaFields = listOf(
                "Submission ID" to submission.id,
                "Campaign" to submission.campaignId,
                "Template" to submission.templateId,
                "Domain" to (submission.domain ?: "N/A"),
                "Status" to submission.syncStatus,
                "Created" to dateFormat.format(Date(submission.offlineCreatedAt)),
                "GPS" to if (submission.gpsLat != null) {
                    "%.6f, %.6f".format(
                        submission.gpsLat,
                        submission.gpsLng,
                    )
                } else "N/A",
            )

            for ((label, value) in metaFields) {
                canvas.drawText("$label:", MARGIN + 8f, yPos, labelPaint)
                canvas.drawText(value, MARGIN + 120f, yPos, valuePaint)
                yPos += LINE_HEIGHT
            }

            // Divider
            yPos += 5f
            canvas.drawLine(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos, linePaint)
            yPos += 15f

            // Form data section
            canvas.drawText("Form Data", MARGIN, yPos, headerPaint)
            yPos += LINE_HEIGHT + 4f

            val formData = parseFormData(submission.data)
            for ((key, value) in formData) {
                val result = checkPageBreak(document, page, canvas, yPos, pageNumber)
                if (result != null) { page = result.first; canvas = result.second; yPos = MARGIN; pageNumber++ }

                canvas.drawText("$key:", MARGIN + 8f, yPos, labelPaint)
                val maxValueWidth = PAGE_WIDTH - MARGIN * 2 - 130f
                val valueLines = wrapText(value, valuePaint, maxValueWidth)
                for ((i, line) in valueLines.withIndex()) {
                    canvas.drawText(line, MARGIN + 130f, yPos + (i * LINE_HEIGHT), valuePaint)
                }
                yPos += LINE_HEIGHT * valueLines.size.coerceAtLeast(1)
            }

            // Quality Gates section
            val qualityResults = submission.qualityGateResults
            if (!qualityResults.isNullOrEmpty() && qualityResults != "null") {
                yPos += 10f
                val result = checkPageBreak(document, page, canvas, yPos + 100f, pageNumber)
                if (result != null) { page = result.first; canvas = result.second; yPos = MARGIN; pageNumber++ }

                canvas.drawLine(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos, linePaint)
                yPos += 15f
                canvas.drawText("Data Quality Gates", MARGIN, yPos, headerPaint)
                yPos += LINE_HEIGHT

                val gateNames = listOf(
                    "completeness" to "Completeness",
                    "temporal" to "Temporal Consistency",
                    "geographic" to "Geographic Consistency",
                    "codes" to "Codes & Vocabularies",
                    "units" to "Units",
                    "deduplication" to "Deduplication",
                    "auditability" to "Auditability",
                    "confidence" to "Confidence Score",
                )

                try {
                    val gates = json.parseToJsonElement(qualityResults) as? JsonObject
                    if (gates != null) {
                        for ((gateKey, gateName) in gateNames) {
                            val gateVal = gates[gateKey]?.jsonPrimitive?.content ?: "skipped"
                            val paint = when (gateVal.lowercase()) {
                                "passed", "pass", "true" -> passedPaint
                                "failed", "fail", "false" -> failedPaint
                                else -> valuePaint
                            }
                            val displayStatus = when (gateVal.lowercase()) {
                                "passed", "pass", "true" -> "PASSED"
                                "failed", "fail", "false" -> "FAILED"
                                else -> gateVal.uppercase()
                            }
                            canvas.drawText("$gateName:", MARGIN + 8f, yPos, labelPaint)
                            canvas.drawText(displayStatus, MARGIN + 220f, yPos, paint)
                            yPos += LINE_HEIGHT
                        }
                    }
                } catch (_: Exception) {
                    canvas.drawText(qualityResults, MARGIN + 8f, yPos, valuePaint)
                    yPos += LINE_HEIGHT
                }
            }

            // Workflow status
            if (submission.workflowLevel > 0) {
                yPos += 10f
                val result = checkPageBreak(document, page, canvas, yPos + 80f, pageNumber)
                if (result != null) { page = result.first; canvas = result.second; yPos = MARGIN; pageNumber++ }

                canvas.drawLine(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos, linePaint)
                yPos += 15f
                canvas.drawText("Workflow Status", MARGIN, yPos, headerPaint)
                yPos += LINE_HEIGHT
                val levelLabels = listOf("National Steward", "Data Owner / CVO", "REC Steward", "AU-IBAR")
                for (i in 1..4) {
                    val status = when {
                        i < submission.workflowLevel -> "Approved"
                        i == submission.workflowLevel -> submission.workflowStatus ?: "Pending"
                        else -> "Not started"
                    }
                    val paint = when (status.lowercase()) {
                        "approved" -> passedPaint
                        "rejected" -> failedPaint
                        else -> valuePaint
                    }
                    canvas.drawText("Level $i (${levelLabels[i - 1]}):", MARGIN + 8f, yPos, labelPaint)
                    canvas.drawText(status, MARGIN + 220f, yPos, paint)
                    yPos += LINE_HEIGHT
                }
            }

            // Footer
            yPos = PAGE_HEIGHT - MARGIN
            canvas.drawLine(MARGIN, yPos - 10f, PAGE_WIDTH - MARGIN, yPos - 10f, linePaint)
            canvas.drawText(
                "Generated by ARIS Mobile on ${dateFormat.format(Date())}",
                MARGIN, yPos, metaPaint,
            )

            document.finishPage(page)

            val pdfDir = File(context.cacheDir, "exports")
            pdfDir.mkdirs()
            val fileName = "submission_${submission.id.take(8)}_${System.currentTimeMillis()}.pdf"
            val file = File(pdfDir, fileName)
            FileOutputStream(file).use { out -> document.writeTo(out) }
            document.close()
            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Export a summary report for multiple submissions (e.g., campaign or domain summary).
     */
    fun exportSummaryReport(
        context: Context,
        title: String,
        submissions: List<Submission>,
    ): File? {
        return try {
            val document = PdfDocument()
            var pageNumber = 1
            var pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
            var page = document.startPage(pageInfo)
            var canvas = page.canvas
            var yPos = MARGIN

            val titlePaint = createPaint(Color.rgb(27, 94, 32), 20f, bold = true)
            val headerPaint = createPaint(Color.rgb(27, 94, 32), 14f, bold = true)
            val labelPaint = createPaint(Color.DKGRAY, 11f, bold = true)
            val valuePaint = createPaint(Color.BLACK, 11f)
            val metaPaint = createPaint(Color.GRAY, 9f)
            val linePaint = Paint().apply { color = Color.LTGRAY; strokeWidth = 1f }
            val dateFormat = SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault())

            // Title
            canvas.drawText("ARIS - $title", MARGIN, yPos + 20f, titlePaint)
            yPos += 35f
            canvas.drawLine(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos, linePaint)
            yPos += 15f

            // Summary stats
            canvas.drawText("Summary", MARGIN, yPos, headerPaint)
            yPos += LINE_HEIGHT
            val total = submissions.size
            val synced = submissions.count { it.syncStatus == "SYNCED" }
            val pending = submissions.count { it.syncStatus == "PENDING" }
            val failed = submissions.count { it.syncStatus == "FAILED" }
            val domains = submissions.mapNotNull { it.domain }.distinct()

            val stats = listOf(
                "Total Submissions" to "$total",
                "Synced" to "$synced",
                "Pending" to "$pending",
                "Failed" to "$failed",
                "Domains" to domains.joinToString(", ").ifEmpty { "N/A" },
                "Report Date" to dateFormat.format(Date()),
            )
            for ((label, value) in stats) {
                canvas.drawText("$label:", MARGIN + 8f, yPos, labelPaint)
                canvas.drawText(value, MARGIN + 180f, yPos, valuePaint)
                yPos += LINE_HEIGHT
            }

            yPos += 10f
            canvas.drawLine(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos, linePaint)
            yPos += 15f

            // Submission table header
            canvas.drawText("Submissions", MARGIN, yPos, headerPaint)
            yPos += LINE_HEIGHT + 4f
            canvas.drawText("ID", MARGIN + 8f, yPos, labelPaint)
            canvas.drawText("Campaign", MARGIN + 80f, yPos, labelPaint)
            canvas.drawText("Status", MARGIN + 300f, yPos, labelPaint)
            canvas.drawText("Date", MARGIN + 380f, yPos, labelPaint)
            yPos += LINE_HEIGHT

            for (sub in submissions) {
                val result = checkPageBreak(document, page, canvas, yPos, pageNumber)
                if (result != null) { page = result.first; canvas = result.second; yPos = MARGIN; pageNumber++ }

                canvas.drawText(sub.id.take(8), MARGIN + 8f, yPos, valuePaint)
                canvas.drawText(sub.campaignId.take(20), MARGIN + 80f, yPos, valuePaint)
                canvas.drawText(sub.syncStatus, MARGIN + 300f, yPos, valuePaint)
                canvas.drawText(dateFormat.format(Date(sub.offlineCreatedAt)), MARGIN + 380f, yPos, valuePaint)
                yPos += LINE_HEIGHT
            }

            // Footer
            yPos = PAGE_HEIGHT - MARGIN
            canvas.drawLine(MARGIN, yPos - 10f, PAGE_WIDTH - MARGIN, yPos - 10f, linePaint)
            canvas.drawText("Generated by ARIS Mobile on ${dateFormat.format(Date())}", MARGIN, yPos, metaPaint)

            document.finishPage(page)

            val pdfDir = File(context.cacheDir, "exports")
            pdfDir.mkdirs()
            val fileName = "report_${System.currentTimeMillis()}.pdf"
            val file = File(pdfDir, fileName)
            FileOutputStream(file).use { out -> document.writeTo(out) }
            document.close()
            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun shareFile(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share PDF"))
    }

    private fun checkPageBreak(
        document: PdfDocument,
        currentPage: PdfDocument.Page,
        canvas: Canvas,
        yPos: Float,
        pageNumber: Int,
    ): Pair<PdfDocument.Page, Canvas>? {
        if (yPos > PAGE_HEIGHT - MARGIN - LINE_HEIGHT) {
            document.finishPage(currentPage)
            val newPageNumber = pageNumber + 1
            val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, newPageNumber).create()
            val newPage = document.startPage(pageInfo)
            return newPage to newPage.canvas
        }
        return null
    }

    private fun parseFormData(jsonStr: String): List<Pair<String, String>> {
        return try {
            val obj = json.parseToJsonElement(jsonStr) as? JsonObject ?: return emptyList()
            obj.entries.map { (key, value) ->
                val displayValue = when (value) {
                    is JsonArray -> value.joinToString(", ") { it.jsonPrimitive.content }
                    is JsonObject -> value.toString()
                    else -> try { value.jsonPrimitive.content } catch (_: Exception) { value.toString() }
                }
                key to displayValue
            }
        } catch (_: Exception) {
            listOf("raw_data" to jsonStr)
        }
    }

    private fun wrapText(text: String, paint: Paint, maxWidth: Float): List<String> {
        if (paint.measureText(text) <= maxWidth) return listOf(text)
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var current = ""
        for (word in words) {
            val test = if (current.isEmpty()) word else "$current $word"
            if (paint.measureText(test) <= maxWidth) {
                current = test
            } else {
                if (current.isNotEmpty()) lines.add(current)
                current = word
            }
        }
        if (current.isNotEmpty()) lines.add(current)
        return lines.ifEmpty { listOf(text) }
    }

    private fun createPaint(color: Int, textSize: Float, bold: Boolean = false) = Paint().apply {
        this.color = color
        this.textSize = textSize
        this.isFakeBoldText = bold
        this.isAntiAlias = true
    }
}
