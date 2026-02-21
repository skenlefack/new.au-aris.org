package org.auibar.aris.mobile.ui.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

data class LineChartPoint(
    val label: String,
    val value: Float,
)

/**
 * Simple line chart for time-series data (e.g., submissions over time).
 * Shows a filled area under the line with gradient.
 */
@Composable
fun LineChart(
    points: List<LineChartPoint>,
    lineColor: Color = MaterialTheme.colorScheme.primary,
    modifier: Modifier = Modifier,
) {
    if (points.size < 2) return

    val maxValue = points.maxOf { it.value }.coerceAtLeast(1f)
    val minValue = 0f
    val description = "Line chart showing ${points.size} data points"

    Column(modifier = modifier.fillMaxWidth()) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .semantics { contentDescription = description },
        ) {
            val spacing = size.width / (points.size - 1)
            val valueRange = (maxValue - minValue).coerceAtLeast(1f)

            // Draw grid lines
            val gridColor = Color.LightGray.copy(alpha = 0.3f)
            for (i in 0..4) {
                val y = size.height * (1 - i / 4f)
                drawLine(gridColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
            }

            // Build path
            val linePath = Path()
            val fillPath = Path()

            points.forEachIndexed { index, point ->
                val x = index * spacing
                val y = size.height * (1 - (point.value - minValue) / valueRange)

                if (index == 0) {
                    linePath.moveTo(x, y)
                    fillPath.moveTo(x, size.height)
                    fillPath.lineTo(x, y)
                } else {
                    linePath.lineTo(x, y)
                    fillPath.lineTo(x, y)
                }
            }

            fillPath.lineTo(size.width, size.height)
            fillPath.close()

            // Draw fill
            drawPath(fillPath, color = lineColor.copy(alpha = 0.1f))

            // Draw line
            drawPath(linePath, color = lineColor, style = Stroke(width = 2.dp.toPx()))

            // Draw dots
            points.forEachIndexed { index, point ->
                val x = index * spacing
                val y = size.height * (1 - (point.value - minValue) / valueRange)
                drawCircle(lineColor, radius = 3.dp.toPx(), center = Offset(x, y))
            }
        }

        // X-axis labels
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            // Show first, middle, last labels
            if (points.isNotEmpty()) {
                Text(points.first().label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (points.size > 2) {
                    Text(points[points.size / 2].label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(points.last().label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
