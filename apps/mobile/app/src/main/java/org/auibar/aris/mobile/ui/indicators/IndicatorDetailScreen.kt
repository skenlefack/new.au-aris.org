package org.auibar.aris.mobile.ui.indicators

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TrendingFlat
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import org.auibar.aris.mobile.ui.charts.LineChart
import org.auibar.aris.mobile.ui.charts.LineChartPoint
import org.auibar.aris.mobile.ui.components.LoadingSpinner

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IndicatorDetailScreen(
    indicatorId: String,
    onBack: () -> Unit,
    viewModel: IndicatorDetailViewModel = hiltViewModel(),
) {
    val indicator by viewModel.indicator.collectAsStateWithLifecycle()
    val values by viewModel.values.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(indicator?.nameEn ?: stringResource(R.string.indicator_detail), maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button))
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::refreshValues) {
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
        val ind = indicator
        if (ind == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                LoadingSpinner()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Current value card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.current_value), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            Column {
                                Text(
                                    text = ind.lastValue?.let { formatValue(it, ind.decimalPlaces) } ?: "—",
                                    style = MaterialTheme.typography.displaySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                Text(
                                    text = ind.unit,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            val trendColor = when (ind.trend) {
                                "up" -> if (ind.betterIsHigher) Color(0xFF4CAF50) else Color(0xFFF44336)
                                "down" -> if (ind.betterIsHigher) Color(0xFFF44336) else Color(0xFF4CAF50)
                                else -> MaterialTheme.colorScheme.onSurfaceVariant
                            }
                            val trendIcon = when (ind.trend) {
                                "up" -> Icons.AutoMirrored.Filled.TrendingUp
                                "down" -> Icons.AutoMirrored.Filled.TrendingDown
                                else -> Icons.Default.TrendingFlat
                            }
                            Icon(trendIcon, contentDescription = ind.trend, tint = trendColor, modifier = Modifier.size(32.dp))
                        }
                        if (ind.targetValue != null) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "${stringResource(R.string.target)}: ${formatValue(ind.targetValue, ind.decimalPlaces)} ${ind.unit}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // History chart
            if (values.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(stringResource(R.string.history), style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(12.dp))
                            val chartPoints = values.reversed().map { v ->
                                val label = if (v.month != null) "${v.year}-${v.month}" else "${v.year}"
                                LineChartPoint(label = label, value = v.value.toFloat())
                            }
                            LineChart(
                                points = chartPoints,
                                modifier = Modifier.fillMaxWidth().height(200.dp),
                            )
                        }
                    }
                }
            }

            // Metadata card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.details), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(8.dp))
                        MetaRow(stringResource(R.string.indicator_code), ind.code)
                        MetaRow(stringResource(R.string.indicator_type), ind.typeCode)
                        MetaRow(stringResource(R.string.measurement_mode), ind.measurementMode)
                        ind.domainCode?.let { MetaRow(stringResource(R.string.campaign_domain), it) }
                        if (ind.descriptionEn != null) {
                            Spacer(Modifier.height(8.dp))
                            Text(ind.descriptionEn, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

@Composable
private fun MetaRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
    }
}

private fun formatValue(value: Double, decimals: Int): String {
    return if (value >= 1_000_000) String.format("%.1fM", value / 1_000_000)
    else if (value >= 1_000) String.format("%.1fK", value / 1_000)
    else String.format("%.${decimals}f", value)
}
