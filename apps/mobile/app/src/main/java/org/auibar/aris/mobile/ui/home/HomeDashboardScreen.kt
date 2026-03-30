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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.res.stringResource
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.LocalWindowType
import org.auibar.aris.mobile.ui.components.RoleConfig
import org.auibar.aris.mobile.ui.components.WindowType
import org.auibar.aris.mobile.ui.theme.GradientDarkGreen
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal

// ── Colors matching the web screenshot ─────────────────────────────
private val KpiGreen = Color(0xFF1B5E20)
private val ChartOrange = Color(0xFFFF9800)
private val ChartRed = Color(0xFFE53935)
private val ChartYellow = Color(0xFFFFC107)
private val ChartGreen = Color(0xFF4CAF50)
private val ChartTeal = Color(0xFF009688)
private val ChartCyan = Color(0xFF00BCD4)
private val ChartBlue = Color(0xFF2196F3)
private val ChartPurple = Color(0xFF9C27B0)
private val ChartDarkRed = Color(0xFF8B0000)
private val ChartDeepGreen = Color(0xFF006B3F)

// ── Data structures ────────────────────────────────────────────────
private data class BarEntry(val label: String, val value: Float, val color: Color)
private data class PieSlice(val label: String, val value: Float, val color: Color)
private data class TrendPoint(val month: String, val outbreaks: Float, val submissions: Float)
private data class AlertEntry(
    val disease: String,
    val country: String,
    val message: String,
    val color: Color,
)

// ── Screen ─────────────────────────────────────────────────────────
@Suppress("UNUSED_PARAMETER")
@Composable
fun HomeDashboardScreen(
    onReports: () -> Unit = {},
    onAnalytics: () -> Unit = {},
    viewModel: HomeDashboardViewModel = hiltViewModel(),
) {
    @Suppress("UNUSED_VARIABLE")
    val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
    val serverKpis by viewModel.kpis.collectAsStateWithLifecycle()

    // Use server KPIs if available, otherwise fallback to static data
    val displayKpis = remember(serverKpis) {
        if (serverKpis.isNotEmpty()) {
            serverKpis.map { formatKpiValue(it.value, it.unit) to it.label.uppercase() }
        } else {
            fallbackKpiItems
        }
    }

    val userDomains = viewModel.userDomains
    val activeDomains = viewModel.activeDomains

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        // ── Domain scope indicator (when user has limited domains) ──
        if (userDomains.isNotEmpty() && userDomains.size < activeDomains.size) {
            item {
                val domainLabels = remember(userDomains, activeDomains) {
                    val mappedKeys = userDomains.map { RoleConfig.backendToMobileKey(it) }.toSet()
                    activeDomains.filter { it.key in mappedKeys }.map { it.label }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f))
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Scope: ${domainLabels.joinToString(", ")}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        }

        // ── KPI Strip ──────────────────────────────────────────────
        item { KpiStrip(displayKpis) }

        // ── Africa Outbreak Map ──────────────────────────────────
        item {
            WidgetCard(title = "OUTBREAK MAP \u2014 AFRICA") {
                AfricaOutbreakMap()
            }
        }

        // ── Chart widgets — paired side-by-side on tablets ─────────
        if (LocalWindowType.current != WindowType.COMPACT) {
            // Tablet: 2 charts per row
            item {
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "OUTBREAKS BY REC") {
                            HorizontalBarChart(entries = outbreaksByRec)
                        }
                    }
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "DISEASE DISTRIBUTION") {
                            DonutChart(slices = diseaseDistribution)
                        }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "CASES BY DISEASE") {
                            HorizontalBarChart(entries = casesByDisease)
                        }
                    }
                    Box(Modifier.weight(1f)) {
                        WidgetCard(title = "TOP COUNTRIES \u2014 CASES") {
                            HorizontalBarChart(entries = topCountries)
                        }
                    }
                }
            }
            item {
                WidgetCard(title = "MONTHLY TREND \u2014 OUTBREAKS & SUBMISSIONS") {
                    LineChart(points = monthlyTrend)
                }
            }
        } else {
            // Phone: single column
            item {
                WidgetCard(title = "OUTBREAKS BY REC") {
                    HorizontalBarChart(entries = outbreaksByRec)
                }
            }
            item {
                WidgetCard(title = "DISEASE DISTRIBUTION") {
                    DonutChart(slices = diseaseDistribution)
                }
            }
            item {
                WidgetCard(title = "CASES BY DISEASE") {
                    HorizontalBarChart(entries = casesByDisease)
                }
            }
            item {
                WidgetCard(title = "MONTHLY TREND \u2014 OUTBREAKS & SUBMISSIONS") {
                    LineChart(points = monthlyTrend)
                }
            }
            item {
                WidgetCard(title = "TOP COUNTRIES \u2014 CASES") {
                    HorizontalBarChart(entries = topCountries)
                }
            }
        }

        // ── Row 6: Active Alerts ───────────────────────────────────
        item {
            WidgetCard(title = "ACTIVE ALERTS (${activeAlerts.size})") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    activeAlerts.forEach { alert ->
                        AlertRow(alert)
                    }
                }
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════
//  KPI STRIP — green gradient with 8 metrics
// ══════════════════════════════════════════════════════════════════
@Composable
private fun KpiStrip(kpiItems: List<Pair<String, String>>) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(GradientDarkGreen, GradientMidGreen, GradientTeal),
                ),
            )
            .padding(vertical = 10.dp),
    ) {
        LazyRow(
            contentPadding = PaddingValues(horizontal = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            items(kpiItems) { kpi ->
                Column(
                    modifier = Modifier
                        .width(96.dp)
                        .padding(horizontal = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = kpi.first,
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 22.sp),
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                    )
                    Text(
                        text = kpi.second,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp),
                        color = Color.White.copy(alpha = 0.75f),
                        maxLines = 1,
                        textAlign = TextAlign.Center,
                        letterSpacing = 0.5.sp,
                    )
                }
            }
        }
    }
}

private fun formatKpiValue(value: Double, unit: String): String {
    return when {
        unit == "%" -> "${value.toLong()}%"
        value >= 1_000_000_000 -> "%.1fbn".format(value / 1_000_000_000)
        value >= 1_000_000 -> "%.1fM".format(value / 1_000_000)
        value >= 1_000 -> "%.1fK".format(value / 1_000)
        value == value.toLong().toDouble() -> value.toLong().toString()
        else -> "%.1f".format(value)
    }
}

private val fallbackKpiItems = listOf(
    "42" to "COUNTRIES / REGIONS",
    "831" to "REPORTS",
    "385.4M" to "VACCINATIONS",
    "43.7M" to "ANIMALS TREATED",
    "1.9M" to "PEOPLE TRAINED",
    "8" to "ACTIVE ALERTS",
    "87%" to "VALIDATION RATE",
    "1.7bn" to "TOTAL RECORDS",
)

// ══════════════════════════════════════════════════════════════════
//  WIDGET CARD — wrapper with title
// ══════════════════════════════════════════════════════════════════
@Composable
private fun WidgetCard(
    title: String,
    content: @Composable () -> Unit,
) {
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

// ══════════════════════════════════════════════════════════════════
//  HORIZONTAL BAR CHART
// ══════════════════════════════════════════════════════════════════
@Composable
private fun HorizontalBarChart(entries: List<BarEntry>) {
    val maxVal = remember(entries) { entries.maxOfOrNull { it.value } ?: 1f }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        entries.forEach { entry ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = entry.label,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(70.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(16.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (entry.value / maxVal).coerceIn(0f, 1f))
                            .height(16.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(entry.color),
                    )
                }
                Text(
                    text = entry.value.toLong().toString(),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.width(48.dp),
                    textAlign = TextAlign.End,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════
//  DONUT CHART (Canvas)
// ══════════════════════════════════════════════════════════════════
@Composable
private fun DonutChart(slices: List<PieSlice>) {
    val total = remember(slices) { slices.sumOf { it.value.toDouble() }.toFloat() }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        // Donut
        Canvas(
            modifier = Modifier
                .size(140.dp)
                .padding(8.dp),
        ) {
            val strokeWidth = 28.dp.toPx()
            val radius = (size.minDimension - strokeWidth) / 2f
            val topLeft = Offset(
                (size.width - radius * 2 - strokeWidth) / 2f,
                (size.height - radius * 2 - strokeWidth) / 2f,
            )
            val arcSize = Size(radius * 2 + strokeWidth, radius * 2 + strokeWidth)
            var startAngle = -90f

            slices.forEach { slice ->
                val sweep = (slice.value / total) * 360f
                drawArc(
                    color = slice.color,
                    startAngle = startAngle,
                    sweepAngle = sweep,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth),
                )
                startAngle += sweep
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Legend
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            slices.forEach { slice ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(slice.color),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = slice.label,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════
//  LINE CHART (Canvas) — 2 lines: Outbreaks + Submissions
// ══════════════════════════════════════════════════════════════════
@Composable
private fun LineChart(points: List<TrendPoint>) {
    val maxVal = remember(points) {
        points.maxOf { maxOf(it.outbreaks, it.submissions) }.coerceAtLeast(1f)
    }

    Column {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .padding(start = 32.dp, end = 8.dp, top = 8.dp, bottom = 24.dp),
        ) {
            val w = size.width
            val h = size.height
            val stepX = w / (points.size - 1).coerceAtLeast(1)

            // Grid lines
            for (i in 0..4) {
                val y = h * i / 4f
                drawLine(
                    Color(0xFFE0E0E0),
                    Offset(0f, y),
                    Offset(w, y),
                    strokeWidth = 1f,
                )
            }

            // Submissions line (blue)
            val subPath = Path()
            points.forEachIndexed { i, p ->
                val x = i * stepX
                val y = h * (1 - p.submissions / maxVal)
                if (i == 0) subPath.moveTo(x, y) else subPath.lineTo(x, y)
            }
            drawPath(subPath, ChartBlue, style = Stroke(width = 2.5.dp.toPx()))

            // Outbreaks line (red)
            val outPath = Path()
            points.forEachIndexed { i, p ->
                val x = i * stepX
                val y = h * (1 - p.outbreaks / maxVal)
                if (i == 0) outPath.moveTo(x, y) else outPath.lineTo(x, y)
            }
            drawPath(outPath, ChartRed, style = Stroke(width = 2.5.dp.toPx()))

            // Dots
            points.forEachIndexed { i, p ->
                val x = i * stepX
                drawCircle(ChartBlue, 3.dp.toPx(), Offset(x, h * (1 - p.submissions / maxVal)))
                drawCircle(ChartRed, 3.dp.toPx(), Offset(x, h * (1 - p.outbreaks / maxVal)))
            }

            // Y-axis labels
            val paint = android.graphics.Paint().apply {
                color = 0xFF999999.toInt()
                textSize = 9.sp.toPx()
                textAlign = android.graphics.Paint.Align.RIGHT
            }
            for (i in 0..4) {
                val value = (maxVal * (4 - i) / 4f).toLong()
                drawContext.canvas.nativeCanvas.drawText(
                    value.toString(),
                    -4.dp.toPx(),
                    h * i / 4f + 4.dp.toPx(),
                    paint,
                )
            }

            // X-axis labels
            val xPaint = android.graphics.Paint().apply {
                color = 0xFF999999.toInt()
                textSize = 9.sp.toPx()
                textAlign = android.graphics.Paint.Align.CENTER
            }
            points.forEachIndexed { i, p ->
                drawContext.canvas.nativeCanvas.drawText(
                    p.month,
                    i * stepX,
                    h + 14.dp.toPx(),
                    xPaint,
                )
            }
        }

        // Legend
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            LegendDot(color = ChartRed, label = stringResource(R.string.outbreaks))
            Spacer(modifier = Modifier.width(16.dp))
            LegendDot(color = ChartBlue, label = stringResource(R.string.submissions))
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color),
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// ══════════════════════════════════════════════════════════════════
//  ALERT ROW
// ══════════════════════════════════════════════════════════════════
@Composable
private fun AlertRow(alert: AlertEntry) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .size(10.dp)
                .clip(CircleShape)
                .background(alert.color),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column {
            Text(
                text = "${alert.disease} \u2014 ${alert.country}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = alert.message,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// ══════════════════════════════════════════════════════════════════
//  AFRICA OUTBREAK MAP — Leaflet + OSM (same as web version)
//  Uses WebViewAssetLoader to serve local assets via HTTPS URL.
//  Leaflet JS/CSS loaded locally; only OSM tiles need internet.
// ══════════════════════════════════════════════════════════════════
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
                // Don't use wide viewport / overview mode — they force a 980px desktop
                // viewport that conflicts with Leaflet coordinate calculations.
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
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest,
                    ): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }
                }

                // Defer loadUrl until after Compose has measured and laid out this view.
                // Without post{}, Leaflet reads a 0x0 container and renders nothing.
                post {
                    loadUrl("https://appassets.androidplatform.net/assets/africa_map.html")
                }
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(if (LocalWindowType.current == WindowType.EXPANDED) 480.dp else 320.dp)
            .clip(RoundedCornerShape(8.dp)),
    )
}

private val outbreaksByRec = listOf(
    BarEntry("IGAD", 216f, ChartOrange),
    BarEntry("", 207f, ChartBlue),
    BarEntry("SADC", 140f, ChartBlue),
    BarEntry("", 119f, ChartDarkRed),
    BarEntry("COMESA", 71f, ChartGreen),
    BarEntry("", 61f, ChartPurple),
    BarEntry("EAC", 45f, ChartDeepGreen),
)

private val diseaseDistribution = listOf(
    PieSlice("FMD", 4500f, ChartRed),
    PieSlice("PPR", 3200f, ChartOrange),
    PieSlice("HPAI", 2800f, ChartYellow),
    PieSlice("ASF", 2100f, ChartGreen),
    PieSlice("RVF", 1800f, ChartTeal),
    PieSlice("LSD", 1500f, ChartCyan),
    PieSlice("CBPP", 980f, ChartBlue),
)

private val casesByDisease = listOf(
    BarEntry("FMD", 4500f, ChartRed),
    BarEntry("PPR", 3200f, ChartOrange),
    BarEntry("HPAI", 2800f, ChartYellow),
    BarEntry("ASF", 2100f, ChartGreen),
    BarEntry("RVF", 1800f, ChartTeal),
    BarEntry("LSD", 1500f, ChartCyan),
    BarEntry("Rabies", 1200f, ChartPurple),
)

private val monthlyTrend = listOf(
    TrendPoint("Feb", 120f, 950f),
    TrendPoint("Apr", 280f, 1900f),
    TrendPoint("Jun", 350f, 2850f),
    TrendPoint("Aug", 410f, 3800f),
    TrendPoint("Oct", 300f, 2800f),
    TrendPoint("Dec", 220f, 2100f),
)

private val topCountries = listOf(
    BarEntry("Egypt", 3456f, ChartDeepGreen),
    BarEntry("", 2800f, ChartDeepGreen),
    BarEntry("S. Africa", 2100f, ChartDeepGreen),
    BarEntry("", 1560f, ChartDeepGreen),
    BarEntry("DR Congo", 1234f, ChartDeepGreen),
    BarEntry("", 1100f, ChartDeepGreen),
    BarEntry("Sudan", 980f, ChartDeepGreen),
    BarEntry("", 920f, ChartDeepGreen),
    BarEntry("Uganda", 890f, ChartDeepGreen),
    BarEntry("", 670f, ChartDeepGreen),
)

private val activeAlerts = listOf(
    AlertEntry("ASF", "Uganda", "New ASF outbreak confirmed in Kampala District ...", ChartRed),
    AlertEntry("HPAI", "Egypt", "H5N1 detected in commercial poultry farm near ...", ChartRed),
    AlertEntry("FMD", "Kenya", "FMD cases increasing in Rift Valley Province", ChartOrange),
    AlertEntry("RVF", "Somalia", "RVF risk elevated due to heavy rainfall forecast", ChartOrange),
    AlertEntry("PPR", "Ethiopia", "PPR vaccination campaign 94% coverage achieved", ChartBlue),
    AlertEntry("ASF", "Nigeria", "Border surveillance — positive cases in neighboring region", ChartRed),
    AlertEntry("LSD", "Tanzania", "LSD clusters reported in 3 districts", ChartOrange),
    AlertEntry("CBPP", "Chad", "CBPP surveillance intensified in pastoral zones", ChartOrange),
)
