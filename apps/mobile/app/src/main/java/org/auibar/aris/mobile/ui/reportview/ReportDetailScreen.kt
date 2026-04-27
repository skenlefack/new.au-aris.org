package org.auibar.aris.mobile.ui.reportview

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportDetailScreen(
    reportId: String,
    onBack: () -> Unit,
    viewModel: ReportDetailViewModel = hiltViewModel(),
) {
    val report by viewModel.report.collectAsStateWithLifecycle()
    val isDownloading by viewModel.isDownloading.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(report?.titleEn ?: stringResource(R.string.report_detail), maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { padding ->
        val rpt = report
        if (rpt == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { LoadingSpinner() }
            return@Scaffold
        }

        when (rpt.pdfDownloadStatus) {
            "DOWNLOADED" -> {
                val pdfFile = rpt.pdfLocalPath?.let { File(it) }
                if (pdfFile != null && pdfFile.exists()) {
                    OfflinePdfViewer(file = pdfFile, modifier = Modifier.fillMaxSize().padding(padding))
                } else {
                    // File missing — offer re-download
                    DownloadPrompt(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        isDownloading = false,
                        onDownload = viewModel::downloadPdf,
                        message = stringResource(R.string.pdf_file_missing),
                    )
                }
            }
            "DOWNLOADING" -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(Modifier.height(12.dp))
                        Text(stringResource(R.string.downloading))
                    }
                }
            }
            else -> {
                DownloadPrompt(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    isDownloading = isDownloading,
                    onDownload = viewModel::downloadPdf,
                    message = stringResource(R.string.pdf_not_downloaded),
                    sizeInfo = rpt.pdfSizeBytes?.let { "${it / 1024}KB" },
                )
            }
        }
    }
}

@Composable
private fun DownloadPrompt(
    modifier: Modifier,
    isDownloading: Boolean,
    onDownload: () -> Unit,
    message: String,
    sizeInfo: String? = null,
) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            sizeInfo?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(16.dp))
            Button(onClick = onDownload, enabled = !isDownloading) {
                if (isDownloading) {
                    CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp))
                } else {
                    Icon(Icons.Default.CloudDownload, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                }
                Text(stringResource(R.string.download_pdf))
            }
        }
    }
}

@Composable
private fun OfflinePdfViewer(file: File, modifier: Modifier = Modifier) {
    var pages by remember { mutableStateOf<List<Bitmap>>(emptyList()) }
    var renderer by remember { mutableStateOf<PdfRenderer?>(null) }

    DisposableEffect(file) {
        try {
            val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val pdfRenderer = PdfRenderer(fd)
            val bitmaps = mutableListOf<Bitmap>()
            for (i in 0 until pdfRenderer.pageCount.coerceAtMost(50)) {
                val page = pdfRenderer.openPage(i)
                val bitmap = Bitmap.createBitmap(page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                page.close()
                bitmaps.add(bitmap)
            }
            pages = bitmaps
            renderer = pdfRenderer
        } catch (_: Exception) {
            pages = emptyList()
        }
        onDispose {
            renderer?.close()
        }
    }

    if (pages.isEmpty()) {
        Box(modifier, contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.pdf_render_error), color = MaterialTheme.colorScheme.error)
        }
    } else {
        LazyColumn(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            item {
                Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.Center) {
                    Text("${pages.size} pages", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            itemsIndexed(pages) { _, bitmap ->
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
