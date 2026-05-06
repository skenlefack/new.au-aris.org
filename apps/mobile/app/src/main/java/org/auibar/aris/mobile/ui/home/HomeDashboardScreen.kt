package org.auibar.aris.mobile.ui.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Dataset
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Vaccines
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.LocalWindowType
import org.auibar.aris.mobile.ui.components.WindowType
import org.auibar.aris.mobile.ui.theme.GradientDarkGreen
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal

// ── Colors ────────────────────────────────────────────────────
private val ChartRed = Color(0xFFEF4444)
private val ChartOrange = Color(0xFFF97316)
private val ChartYellow = Color(0xFFEAB308)
private val ChartGreen = Color(0xFF22C55E)
private val ChartTeal = Color(0xFF06B6D4)
private val ChartBlue = Color(0xFF3B82F6)
private val ChartPurple = Color(0xFF8B5CF6)
private val ChartPink = Color(0xFFD946EF)
private val ChartDeepGreen = Color(0xFF006B3F)
private val AccentGreen = Color(0xFF1B5E20)

private val CHART_PALETTE = listOf(
    ChartRed, ChartOrange, ChartYellow, ChartGreen, ChartTeal,
    ChartBlue, ChartPurple, ChartPink,
)

// ── Data structures ───────────────────────────────────────────
private data class BarEntry(val label: String, val value: Float, val color: Color)
private data class PieSlice(val label: String, val value: Float, val color: Color)
private data class TrendPoint(val month: String, val outbreaks: Float, val submissions: Float)

// ── KPI mapping (same 8 KPIs as web DashboardKpiBar) ─────────
private data class KpiDef(val key: String, val icon: ImageVector, val subtitle: String)

private val KPI_DEFS = listOf(
    KpiDef("countries_reporting", Icons.Default.Public, "reporting"),
    KpiDef("health_reports", Icons.Default.BarChart, "monthly reports"),
    KpiDef("outbreaks", Icons.Default.BugReport, "declared"),
    KpiDef("diseases_monitored", Icons.Default.Science, "monitored"),
    KpiDef("animals_vaccinated", Icons.Default.Vaccines, "total"),
    KpiDef("mass_vaccinations", Icons.Default.LocalHospital, "mass campaigns"),
    KpiDef("livestock_censused", Icons.Default.Pets, "head count"),
    KpiDef("total_records", Icons.Default.Dataset, "datasets"),
)

// ── Screen ────────────────────────────────────────────────────
@Composable
fun HomeDashboardScreen(
    onReports: () -> Unit = {},
    onAnalytics: () -> Unit = {},
    viewModel: HomeDashboardViewModel = hiltViewModel(),
) {
    val serverKpis by viewModel.kpis.collectAsStateWithLifecycle()
    val chartsData by viewModel.charts.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val windowType = LocalWindowType.current

    // Map server KPIs by key for easy lookup
    val kpiMap = remember(serverKpis) {
        serverKpis.associateBy { it.key }
    }

    // Build chart data from API
    val diseaseDist = remember(chartsData) {
        chartsData.diseaseDistribution.mapIndexed { i, e ->
            PieSlice(cleanLabel(e.label), e.value.toFloat(), CHART_PALETTE[i % CHART_PALETTE.size])
        }
    }
    val casesByDisease = remember(chartsData) {
        chartsData.diseaseDistribution.mapIndexed { i, e ->
            BarEntry(cleanLabel(e.label).take(12), e.value.toFloat(), CHART_PALETTE[i % CHART_PALETTE.size])
        }
    }
    val topCountries = remember(chartsData) {
        chartsData.countryDistribution.map { e ->
            BarEntry(e.label.take(14), e.value.toFloat(), ChartDeepGreen)
        }
    }
    val monthlyTrend = remember(chartsData) {
        chartsData.monthlyTrend.map { e ->
            TrendPoint(e.month, e.outbreaks.toFloat(), e.reports.toFloat())
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        // ── KPI Bar (green gradient, icons like web) ──────────
        item { KpiBar(kpiMap, isLoading) }

        // ── Loading indicator ─────────────────────────────────
        if (isLoading && serverKpis.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AccentGreen)
                }
            }
        }

        // ── Africa Outbreak Map ───────────────────────────────
        item {
            WidgetCard(title = "CONTINENTAL OUTBREAK MAP") {
                AfricaOutbreakMap()
            }
        }

        // ── Charts ────────────────────────────────────────────
        if (windowType != WindowType.COMPACT) {
            // Tablet: 2 per row
            item {
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "OUTBREAK TREND") {
                            if (monthlyTrend.isNotEmpty()) LineChart(points = monthlyTrend)
                            else EmptyChart()
                        }
                    }
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "CASES BY DISEASE") {
                            if (casesByDisease.isNotEmpty()) HorizontalBarChart(entries = casesByDisease)
                            else EmptyChart()
                        }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "DISEASE DISTRIBUTION") {
                            if (diseaseDist.isNotEmpty()) DonutChart(slices = diseaseDist)
                            else EmptyChart()
                        }
                    }
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "TOP COUNTRIES \u2014 REPORTS") {
                            if (topCountries.isNotEmpty()) HorizontalBarChart(entries = topCountries)
                            else EmptyChart()
                        }
                    }
                }
            }
        } else {
            // Phone: single column
            item {
                WidgetCard(title = "OUTBREAK TREND") {
                    if (monthlyTrend.isNotEmpty()) LineChart(points = monthlyTrend) else EmptyChart()
                }
            }
            item {
                WidgetCard(title = "CASES BY DISEASE") {
                    if (casesByDisease.isNotEmpty()) HorizontalBarChart(entries = casesByDisease) else EmptyChart()
                }
            }
            item {
                WidgetCard(title = "DISEASE DISTRIBUTION") {
                    if (diseaseDist.isNotEmpty()) DonutChart(slices = diseaseDist) else EmptyChart()
                }
            }
            item {
                WidgetCard(title = "TOP COUNTRIES \u2014 REPORTS") {
                    if (topCountries.isNotEmpty()) HorizontalBarChart(entries = topCountries) else EmptyChart()
                }
            }
        }
    }
}

/** Clean up disease labels (remove UUIDs, format ZERO-CAS) */
private fun cleanLabel(raw: String): String {
    if (raw.matches(Regex("[0-9a-f]{8}-.*"))) return "Other"
    return raw.replace("-", " ").lowercase().replaceFirstChar { it.uppercase() }
}

// ══════════════════════════════════════════════════════════════
//  KPI BAR — green gradient with 8 metrics + icons (like web)
// ══════════════════════════════════════════════════════════════
@Composable
private fun KpiBar(kpiMap: Map<String, org.auibar.aris.mobile.data.remote.dto.KpiCard>, isLoading: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(GradientDarkGreen, GradientMidGreen, GradientTeal),
                ),
            )
            .padding(vertical = 8.dp),
    ) {
        LazyRow(
            contentPadding = PaddingValues(horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            items(KPI_DEFS) { def ->
                val kpi = kpiMap[def.key]
                val value = kpi?.value ?: 0.0
                val unit = kpi?.unit ?: ""
                val label = kpi?.label ?: def.key.replace("_", " ").replaceFirstChar { it.uppercase() }
                val formatted = formatCompact(value) + unit

                Column(
                    modifier = Modifier
                        .width(100.dp)
                        .padding(horizontal = 2.dp, vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        def.icon,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = formatted,
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp),
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                    )
                    Text(
                        text = label.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp),
                        color = Color.White.copy(alpha = 0.7f),
                        maxLines = 1,
                        textAlign = TextAlign.Center,
                        letterSpacing = 0.5.sp,
                    )
                    Text(
                        text = def.subtitle,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 7.sp),
                        color = Color.White.copy(alpha = 0.45f),
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

private fun formatCompact(v: Double): String = when {
    v >= 1_000_000_000 -> "%.1fbn".format(v / 1_000_000_000)
    v >= 1_000_000 -> "%.1fM".format(v / 1_000_000)
    v >= 1_000 -> "%.1fK".format(v / 1_000)
    v == v.toLong().toDouble() -> v.toLong().toString()
    else -> "%.1f".format(v)
}

// ══════════════════════════════════════════════════════════════
//  WIDGET CARD
// ══════════════════════════════════════════════════════════════
@Composable
private fun WidgetCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                letterSpacing = 0.5.sp,
            )
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun EmptyChart() {
    Box(
        modifier = Modifier.fillMaxWidth().height(100.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Loading data\u2026",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// ══════════════════════════════════════════════════════════════
//  HORIZONTAL BAR CHART
// ══════════════════════════════════════════════════════════════
@Composable
private fun HorizontalBarChart(entries: List<BarEntry>) {
    val maxVal = remember(entries) { entries.maxOfOrNull { it.value } ?: 1f }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        entries.forEach { entry ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(entry.label, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(80.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Box(Modifier.weight(1f).height(16.dp).clip(RoundedCornerShape(3.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                    Box(Modifier.fillMaxWidth(fraction = (entry.value / maxVal).coerceIn(0f, 1f)).height(16.dp).clip(RoundedCornerShape(3.dp)).background(entry.color))
                }
                Text(formatCompact(entry.value.toDouble()), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(52.dp), textAlign = TextAlign.End, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  DONUT CHART
// ══════════════════════════════════════════════════════════════
@Composable
private fun DonutChart(slices: List<PieSlice>) {
    val total = remember(slices) { slices.sumOf { it.value.toDouble() }.toFloat() }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Canvas(Modifier.size(140.dp).padding(8.dp)) {
            val strokeWidth = 28.dp.toPx()
            val radius = (size.minDimension - strokeWidth) / 2f
            val topLeft = Offset((size.width - radius * 2 - strokeWidth) / 2f, (size.height - radius * 2 - strokeWidth) / 2f)
            val arcSize = Size(radius * 2 + strokeWidth, radius * 2 + strokeWidth)
            var startAngle = -90f
            slices.forEach { slice ->
                val sweep = (slice.value / total) * 360f
                drawArc(slice.color, startAngle, sweep, false, topLeft, arcSize, style = Stroke(strokeWidth))
                startAngle += sweep
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            slices.forEach { slice ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(slice.color))
                    Spacer(Modifier.width(6.dp))
                    Text(slice.label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  LINE CHART — 2 lines: Outbreaks + Reports
// ══════════════════════════════════════════════════════════════
@Composable
private fun LineChart(points: List<TrendPoint>) {
    val maxVal = remember(points) { points.maxOf { maxOf(it.outbreaks, it.submissions) }.coerceAtLeast(1f) }
    Column {
        Canvas(Modifier.fillMaxWidth().height(160.dp).padding(start = 32.dp, end = 8.dp, top = 8.dp, bottom = 24.dp)) {
            val w = size.width; val h = size.height
            val stepX = w / (points.size - 1).coerceAtLeast(1)
            for (i in 0..4) { val y = h * i / 4f; drawLine(Color(0xFFE0E0E0), Offset(0f, y), Offset(w, y), 1f) }
            // Reports line (blue)
            val subPath = Path()
            points.forEachIndexed { i, p -> val x = i * stepX; val y = h * (1 - p.submissions / maxVal); if (i == 0) subPath.moveTo(x, y) else subPath.lineTo(x, y) }
            drawPath(subPath, ChartBlue, style = Stroke(width = 2.5.dp.toPx()))
            // Outbreaks line (red)
            val outPath = Path()
            points.forEachIndexed { i, p -> val x = i * stepX; val y = h * (1 - p.outbreaks / maxVal); if (i == 0) outPath.moveTo(x, y) else outPath.lineTo(x, y) }
            drawPath(outPath, ChartRed, style = Stroke(width = 2.5.dp.toPx()))
            points.forEachIndexed { i, p ->
                val x = i * stepX
                drawCircle(ChartBlue, 3.dp.toPx(), Offset(x, h * (1 - p.submissions / maxVal)))
                drawCircle(ChartRed, 3.dp.toPx(), Offset(x, h * (1 - p.outbreaks / maxVal)))
            }
            val paint = android.graphics.Paint().apply { color = 0xFF999999.toInt(); textSize = 9.sp.toPx(); textAlign = android.graphics.Paint.Align.RIGHT }
            for (i in 0..4) { drawContext.canvas.nativeCanvas.drawText((maxVal * (4 - i) / 4f).toLong().toString(), -4.dp.toPx(), h * i / 4f + 4.dp.toPx(), paint) }
            val xPaint = android.graphics.Paint().apply { color = 0xFF999999.toInt(); textSize = 9.sp.toPx(); textAlign = android.graphics.Paint.Align.CENTER }
            points.forEachIndexed { i, p -> drawContext.canvas.nativeCanvas.drawText(p.month, i * stepX, h + 14.dp.toPx(), xPaint) }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.Center) {
            LegendDot(ChartRed, stringResource(R.string.outbreaks))
            Spacer(Modifier.width(16.dp))
            LegendDot(ChartBlue, "Reports")
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ══════════════════════════════════════════════════════════════
//  AFRICA OUTBREAK MAP
// ══════════════════════════════════════════════════════════════
@Composable
private fun AfricaOutbreakMap() {
    @Suppress("SetJavaScriptEnabled")
    AndroidView(
        factory = { context ->
            val assetLoader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                .build()
            WebView(context).apply {
                layoutParams = android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                )
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.loadWithOverviewMode = false
                settings.useWideViewPort = false
                settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                setBackgroundColor(android.graphics.Color.parseColor("#f0f4f8"))
                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                        Log.d("AfricaMap", "${msg.messageLevel()}: ${msg.message()} [${msg.lineNumber()}]")
                        return true
                    }
                }
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }
                }
                post { loadUrl("https://appassets.androidplatform.net/assets/africa_map.html") }
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(if (LocalWindowType.current == WindowType.EXPANDED) 480.dp else 320.dp)
            .clip(RoundedCornerShape(8.dp)),
    )
}
