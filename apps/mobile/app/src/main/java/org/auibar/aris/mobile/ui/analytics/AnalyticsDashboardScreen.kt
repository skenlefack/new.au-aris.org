package org.auibar.aris.mobile.ui.analytics

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.data.remote.dto.KpiCard
import org.auibar.aris.mobile.ui.charts.BarChartItem
import org.auibar.aris.mobile.ui.charts.HorizontalBarChart
import org.auibar.aris.mobile.ui.charts.LineChart
import org.auibar.aris.mobile.ui.charts.LineChartPoint
import org.auibar.aris.mobile.ui.charts.PieChart
import org.auibar.aris.mobile.ui.charts.PieChartSlice
import org.auibar.aris.mobile.ui.charts.SparklineChart

private val DOMAIN_COLORS = mapOf(
    "health" to Color(0xFF1565C0),
    "livestock" to Color(0xFF2E7D32),
    "fisheries" to Color(0xFF00838F),
    "trade" to Color(0xFFE65100),
    "governance" to Color(0xFF6A1B9A),
    "paid" to Color(0xFFC62828),
    "knowledge" to Color(0xFF37474F),
)

private val COUNTRY_COLORS = listOf(
    Color(0xFF1565C0),
    Color(0xFF2E7D32),
    Color(0xFFE65100),
    Color(0xFF6A1B9A),
    Color(0xFF00838F),
    Color(0xFFC62828),
    Color(0xFF37474F),
    Color(0xFF4E342E),
    Color(0xFF283593),
    Color(0xFF00695C),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsDashboardScreen(
    onBack: () -> Unit,
    viewModel: AnalyticsDashboardViewModel = hiltViewModel(),
) {
    val kpis by viewModel.kpis.collectAsStateWithLifecycle()
    val submissionsByDomain by viewModel.submissionsByDomain.collectAsStateWithLifecycle()
    val timeline by viewModel.timeline.collectAsStateWithLifecycle()
    val beneficiariesByCountry by viewModel.beneficiariesByCountry.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val timelinePeriod by viewModel.timelinePeriod.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Analytics Dashboard") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                isLoading && kpis.isEmpty() && submissionsByDomain.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }

                error != null && kpis.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = error ?: "An error occurred",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.error,
                            )
                            Spacer(Modifier.height(16.dp))
                            TextButton(onClick = { viewModel.refresh() }) {
                                Text("Retry")
                            }
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        // Section 1: KPI Cards
                        if (kpis.isNotEmpty()) {
                            item {
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "Key Performance Indicators",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(Modifier.height(8.dp))
                                LazyRow(
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    items(kpis) { kpi ->
                                        KpiCardItem(kpi = kpi)
                                    }
                                }
                            }
                        }

                        // Section 2: Submissions by Domain
                        if (submissionsByDomain.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Submissions by Domain",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(Modifier.height(8.dp))
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surface,
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                ) {
                                    PieChart(
                                        slices = submissionsByDomain.map { item ->
                                            PieChartSlice(
                                                label = item.domain.replaceFirstChar { it.uppercase() },
                                                value = item.count.toFloat(),
                                                color = DOMAIN_COLORS[item.domain.lowercase()]
                                                    ?: MaterialTheme.colorScheme.primary,
                                            )
                                        },
                                        modifier = Modifier.padding(16.dp),
                                    )
                                }
                            }
                        }

                        // Section 3: Beneficiaries by Country
                        if (beneficiariesByCountry.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Beneficiaries by Country",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(Modifier.height(8.dp))
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surface,
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                ) {
                                    HorizontalBarChart(
                                        items = beneficiariesByCountry.mapIndexed { index, item ->
                                            BarChartItem(
                                                label = item.country,
                                                value = item.count.toFloat(),
                                                color = COUNTRY_COLORS[index % COUNTRY_COLORS.size],
                                            )
                                        },
                                        modifier = Modifier.padding(16.dp),
                                    )
                                }
                            }
                        }

                        // Section 4: Submissions Over Time
                        if (timeline.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Submissions Over Time",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    FilterChip(
                                        selected = timelinePeriod == "monthly",
                                        onClick = { viewModel.setTimelinePeriod("monthly") },
                                        label = { Text("Monthly") },
                                    )
                                    FilterChip(
                                        selected = timelinePeriod == "weekly",
                                        onClick = { viewModel.setTimelinePeriod("weekly") },
                                        label = { Text("Weekly") },
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surface,
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                ) {
                                    LineChart(
                                        points = timeline.map { point ->
                                            LineChartPoint(
                                                label = point.date,
                                                value = point.count.toFloat(),
                                            )
                                        },
                                        modifier = Modifier.padding(16.dp),
                                    )
                                }
                            }
                        }

                        // Bottom spacing
                        item {
                            Spacer(Modifier.height(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiCardItem(kpi: KpiCard) {
    Card(
        modifier = Modifier
            .width(180.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
        ) {
            Text(
                text = kpi.label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
            Spacer(Modifier.height(4.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = formatKpiValue(kpi.value, kpi.unit),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.width(8.dp))
                val trendIcon = when (kpi.trend) {
                    "up" -> Icons.AutoMirrored.Filled.TrendingUp
                    "down" -> Icons.AutoMirrored.Filled.TrendingDown
                    else -> Icons.Default.Remove
                }
                val trendColor = when (kpi.trend) {
                    "up" -> Color(0xFF2E7D32)
                    "down" -> Color(0xFFC62828)
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                Icon(
                    imageVector = trendIcon,
                    contentDescription = kpi.trend,
                    modifier = Modifier.size(18.dp),
                    tint = trendColor,
                )
            }
            if (kpi.trendPercent != 0.0) {
                Text(
                    text = "${if (kpi.trendPercent > 0) "+" else ""}${"%.1f".format(kpi.trendPercent)}%",
                    style = MaterialTheme.typography.labelSmall,
                    color = when (kpi.trend) {
                        "up" -> Color(0xFF2E7D32)
                        "down" -> Color(0xFFC62828)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
            Spacer(Modifier.height(8.dp))
            // Sparkline mini-chart using sample trend data
            SparklineChart(
                values = generateSparklineValues(kpi.value.toFloat(), kpi.trend),
                color = when (kpi.trend) {
                    "up" -> Color(0xFF2E7D32)
                    "down" -> Color(0xFFC62828)
                    else -> MaterialTheme.colorScheme.primary
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(32.dp),
            )
        }
    }
}

private fun formatKpiValue(value: Double, unit: String): String {
    val formatted = if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else {
        "%.1f".format(value)
    }
    return if (unit.isNotEmpty()) "$formatted$unit" else formatted
}

/**
 * Generate sparkline values based on the current value and trend direction.
 * Creates a simple series that visually represents the trend.
 */
private fun generateSparklineValues(currentValue: Float, trend: String): List<Float> {
    val base = currentValue.coerceAtLeast(1f)
    return when (trend) {
        "up" -> listOf(
            base * 0.6f, base * 0.65f, base * 0.7f,
            base * 0.75f, base * 0.82f, base * 0.9f, base,
        )
        "down" -> listOf(
            base * 1.4f, base * 1.35f, base * 1.3f,
            base * 1.2f, base * 1.12f, base * 1.05f, base,
        )
        else -> listOf(
            base * 0.98f, base * 1.02f, base * 0.99f,
            base * 1.01f, base * 0.98f, base * 1.01f, base,
        )
    }
}
