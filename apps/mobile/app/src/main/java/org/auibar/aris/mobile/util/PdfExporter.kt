package org.auibar.aris.mobile.util

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.print.PrintAttributes
import androidx.core.content.FileProvider
import kotlinx.serialization.json.Json
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

    fun exportSubmission(context: Context, submission: Submission): File? {
        return try {
            val document = PdfDocument()
            var pageNumber = 1
            var pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
            var page = document.startPage(pageInfo)
            var canvas = page.canvas
            var yPos = MARGIN

            val titlePaint = Paint().apply {
                color = Color.rgb(27, 94, 32) // ArisPrimary
                textSize = 20f
                isFakeBoldText = true
                isAntiAlias = true
            }
            val headerPaint = Paint().apply {
                color = Color.rgb(27, 94, 32)
                textSize = 14f
                isFakeBoldText = true
                isAntiAlias = true
            }
            val labelPaint = Paint().apply {
                color = Color.DKGRAY
                textSize = 11f
                isFakeBoldText = true
                isAntiAlias = true
            }
            val valuePaint = Paint().apply {
                color = Color.BLACK
                textSize = 11f
                isAntiAlias = true
            }
            val metaPaint = Paint().apply {
                color = Color.GRAY
                textSize = 9f
                isAntiAlias = true
            }
            val linePaint = Paint().apply {
                color = Color.LTGRAY
                strokeWidth = 1f
            }

            // Title
            canvas.drawText("ARIS - Submission Report", MARGIN, yPos + 20f, titlePaint)
            yPos += 35f

            // Divider
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
                    "%.6f, %.6f".format(submission.gpsLat, submission.gpsLng)
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
                // Check if we need a new page
                if (yPos > PAGE_HEIGHT - MARGIN - LINE_HEIGHT) {
                    document.finishPage(page)
                    pageNumber++
                    pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
                    page = document.startPage(pageInfo)
                    canvas = page.canvas
                    yPos = MARGIN
                }

                canvas.drawText("$key:", MARGIN + 8f, yPos, labelPaint)
                // Wrap long values
                val maxValueWidth = PAGE_WIDTH - MARGIN * 2 - 130f
                val valueLines = wrapText(value, valuePaint, maxValueWidth)
                for ((i, line) in valueLines.withIndex()) {
                    canvas.drawText(line, MARGIN + 130f, yPos + (i * LINE_HEIGHT), valuePaint)
                }
                yPos += LINE_HEIGHT * valueLines.size.coerceAtLeast(1)
            }

            // Workflow status
            if (submission.workflowLevel > 0) {
                yPos += 10f
                if (yPos > PAGE_HEIGHT - MARGIN - 60f) {
                    document.finishPage(page)
                    pageNumber++
                    pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
                    page = document.startPage(pageInfo)
                    canvas = page.canvas
                    yPos = MARGIN
                }
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
                    canvas.drawText("Level $i (${levelLabels[i - 1]}):", MARGIN + 8f, yPos, labelPaint)
                    canvas.drawText(status, MARGIN + 220f, yPos, valuePaint)
                    yPos += LINE_HEIGHT
                }
            }

            // Footer
            yPos = PAGE_HEIGHT - MARGIN
            canvas.drawLine(MARGIN, yPos - 10f, PAGE_WIDTH - MARGIN, yPos - 10f, linePaint)
            canvas.drawText(
                "Generated by ARIS Mobile on ${dateFormat.format(Date())}",
                MARGIN,
                yPos,
                metaPaint,
            )

            document.finishPage(page)

            // Write to cache directory
            val pdfDir = File(context.cacheDir, "exports")
            pdfDir.mkdirs()
            val fileName = "submission_${submission.id.take(8)}_${System.currentTimeMillis()}.pdf"
            val file = File(pdfDir, fileName)
            FileOutputStream(file).use { out ->
                document.writeTo(out)
            }
            document.close()
            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun shareFile(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share PDF"))
    }

    private fun parseFormData(jsonStr: String): List<Pair<String, String>> {
        return try {
            val obj = json.parseToJsonElement(jsonStr) as? JsonObject ?: return emptyList()
            obj.entries.map { (key, value) ->
                key to (value.jsonPrimitive.content)
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
}
