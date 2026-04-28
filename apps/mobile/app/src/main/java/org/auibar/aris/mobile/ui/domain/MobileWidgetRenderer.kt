package org.auibar.aris.mobile.ui.domain

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.TrendingFlat
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import org.auibar.aris.mobile.data.local.entity.DashboardWidgetEntity

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/**
 * Renders a single dashboard widget based on its type.
 * Mobile-friendly layout (full width, stacked vertically).
 */
@Composable
fun MobileWidgetRenderer(
    widget: DashboardWidgetEntity,
    domainColor: Color,
    modifier: Modifier = Modifier,
) {
    val mobileType = WidgetTypeMapper.backendToMobile(widget.type)
    val config = try {
        json.decodeFromString<JsonObject>(widget.configJson)
    } catch (_: Exception) {
        JsonObject(emptyMap())
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Widget title
            if (widget.titleEn.isNotBlank()) {
                Text(
                    text = widget.titleEn,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(12.dp))
            }

            // Widget content by type
            when (mobileType) {
                "KPI_CARD" -> KpiCardContent(config, domainColor)
                "STAT_CARD" -> StatCardContent(config, domainColor)
                "LINE", "BAR", "STACKED_BAR", "AREA" -> ChartPlaceholder(mobileType, domainColor)
                "PIE" -> PieChartPlaceholder(domainColor)
                "TABLE" -> TablePlaceholder()
                "GAUGE" -> GaugePlaceholder(config, domainColor)
                "TEXT_BLOCK" -> TextBlockContent(config)
                "ALERT_FEED" -> AlertFeedPlaceholder()
                "PROGRESS_BAR" -> ProgressBarContent(config, domainColor)
                "DIVIDER" -> DividerContent()
                "IMAGE" -> ImagePlaceholder(config)
                "MAP" -> MapPlaceholder()
                "IFRAME" -> IframePlaceholder()
                "LIST" -> ListPlaceholder(config)
                else -> UnsupportedContent(mobileType)
            }
        }
    }
}

@Composable
private fun KpiCardContent(config: JsonObject, domainColor: Color) {
    val value = config["value"]?.jsonPrimitive?.content ?: "—"
    val label = config["label"]?.jsonPrimitive?.content ?: ""
    val trend = config["trend"]?.jsonPrimitive?.content
    val trendIcon = when (trend) {
        "up" -> Icons.AutoMirrored.Filled.TrendingUp
        "down" -> Icons.AutoMirrored.Filled.TrendingDown
        else -> Icons.Default.TrendingFlat
    }
    val trendColor = when (trend) {
        "up" -> Color(0xFF4CAF50)
        "down" -> Color(0xFFF44336)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
        Column {
            Text(value, style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = domainColor)
            if (label.isNotBlank()) {
                Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Icon(trendIcon, contentDescription = trend, tint = trendColor, modifier = Modifier.size(28.dp))
    }
}

@Composable
private fun StatCardContent(config: JsonObject, domainColor: Color) {
    val value = config["value"]?.jsonPrimitive?.content ?: "—"
    val previousValue = config["previousValue"]?.jsonPrimitive?.content
    val label = config["label"]?.jsonPrimitive?.content ?: ""

    Column {
        Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = domainColor)
        if (label.isNotBlank()) {
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (previousValue != null) {
            Text("Previous: $previousValue", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
private fun ChartPlaceholder(chartType: String, domainColor: Color) {
    val icon = when (chartType) {
        "LINE", "AREA" -> Icons.Default.ShowChart
        "BAR", "STACKED_BAR" -> Icons.Default.BarChart
        else -> Icons.Default.ShowChart
    }
    Box(
        Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(8.dp)).background(domainColor.copy(alpha = 0.06f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null, tint = domainColor.copy(alpha = 0.4f), modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(8.dp))
            Text(chartType.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelMedium, color = domainColor.copy(alpha = 0.5f))
        }
    }
}

@Composable
private fun PieChartPlaceholder(domainColor: Color) {
    Box(
        Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(8.dp)).background(domainColor.copy(alpha = 0.06f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Default.PieChart, contentDescription = null, tint = domainColor.copy(alpha = 0.4f), modifier = Modifier.size(48.dp))
    }
}

@Composable
private fun TablePlaceholder() {
    Box(
        Modifier.fillMaxWidth().height(120.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Default.TableChart, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f), modifier = Modifier.size(40.dp))
    }
}

@Composable
private fun GaugePlaceholder(config: JsonObject, domainColor: Color) {
    val value = config["value"]?.jsonPrimitive?.doubleOrNull ?: 0.0
    val max = config["max"]?.jsonPrimitive?.doubleOrNull ?: 100.0
    val pct = (value / max).toFloat().coerceIn(0f, 1f)

    Column {
        Text("${(pct * 100).toInt()}%", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = domainColor)
        Spacer(Modifier.height(8.dp))
        LinearProgressIndicator(progress = { pct }, modifier = Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp)), color = domainColor, trackColor = MaterialTheme.colorScheme.surfaceVariant)
    }
}

@Composable
private fun TextBlockContent(config: JsonObject) {
    val text = config["text"]?.jsonPrimitive?.content ?: config["content"]?.jsonPrimitive?.content ?: ""
    if (text.isNotBlank()) {
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun AlertFeedPlaceholder() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(2) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFF57C00), modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Box(Modifier.weight(1f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
            }
        }
    }
}

@Composable
private fun ProgressBarContent(config: JsonObject, domainColor: Color) {
    val value = config["value"]?.jsonPrimitive?.doubleOrNull ?: 0.0
    val max = config["max"]?.jsonPrimitive?.doubleOrNull ?: 100.0
    val label = config["label"]?.jsonPrimitive?.content ?: ""
    val pct = (value / max).toFloat().coerceIn(0f, 1f)

    Column {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodySmall)
            Text("${(pct * 100).toInt()}%", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = domainColor)
        }
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(progress = { pct }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)), color = domainColor, trackColor = MaterialTheme.colorScheme.surfaceVariant)
    }
}

@Composable
private fun DividerContent() {
    Divider(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp))
}

@Composable
private fun ImagePlaceholder(config: JsonObject) {
    val url = config["url"]?.jsonPrimitive?.content ?: config["src"]?.jsonPrimitive?.content ?: ""
    Box(
        Modifier.fillMaxWidth().height(120.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (url.isNotBlank()) "Image" else "No image", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MapPlaceholder() {
    Box(
        Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFE8F5E9)),
        contentAlignment = Alignment.Center,
    ) {
        Text("Africa Map", style = MaterialTheme.typography.labelMedium, color = Color(0xFF2E7D32))
    }
}

@Composable
private fun IframePlaceholder() {
    Box(
        Modifier.fillMaxWidth().height(120.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        Text("Embedded BI content", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ListPlaceholder(config: JsonObject) {
    val items = config["items"]?.toString() ?: ""
    Column {
        if (items.isNotBlank()) {
            Text(items.take(200), style = MaterialTheme.typography.bodySmall)
        } else {
            repeat(3) { i ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(6.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.weight(1f).height(12.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
                }
                if (i < 2) Spacer(Modifier.height(6.dp))
            }
        }
    }
}

@Composable
private fun UnsupportedContent(type: String) {
    Text("Widget: $type", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
}
