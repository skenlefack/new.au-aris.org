package org.auibar.aris.mobile.ui.reportview

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.OfflinePin
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.local.entity.ReportEntity
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportListScreen(
    onReportClick: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: ReportListViewModel = hiltViewModel(),
) {
    val reports by viewModel.reports.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reports)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button))
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::refresh) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.cd_refresh), tint = MaterialTheme.colorScheme.onPrimary)
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
        when {
            isLoading && reports.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { LoadingSpinner() }
            }
            reports.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.no_reports), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(reports, key = { it.id }) { report ->
                        ReportCard(report = report, onClick = { onReportClick(report.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportCard(report: ReportEntity, onClick: () -> Unit) {
    val dateFormat = SimpleDateFormat("MMM yyyy", Locale.getDefault())

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.PictureAsPdf,
                contentDescription = null,
                tint = Color(0xFFD32F2F),
                modifier = Modifier.size(40.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(report.titleEn, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Medium)
                Text(
                    "${report.type} | ${dateFormat.format(Date(report.periodStart))} - ${dateFormat.format(Date(report.periodEnd))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                report.domainCode?.let {
                    Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
            Spacer(Modifier.width(8.dp))
            // Download status badge
            val (icon, color, label) = when (report.pdfDownloadStatus) {
                "DOWNLOADED" -> Triple(Icons.Default.OfflinePin, Color(0xFF4CAF50), stringResource(R.string.offline_available))
                "DOWNLOADING" -> Triple(Icons.Default.CloudDownload, Color(0xFFFFA000), stringResource(R.string.downloading))
                else -> Triple(Icons.Default.CloudDownload, MaterialTheme.colorScheme.onSurfaceVariant, stringResource(R.string.download))
            }
            Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.12f)) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(icon, contentDescription = null, modifier = Modifier.size(14.dp), tint = color)
                    Spacer(Modifier.width(4.dp))
                    Text(label, style = MaterialTheme.typography.labelSmall, color = color)
                }
            }
        }
    }
}
