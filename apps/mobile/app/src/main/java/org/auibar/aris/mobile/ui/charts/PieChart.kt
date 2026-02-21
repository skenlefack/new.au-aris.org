package org.auibar.aris.mobile.ui.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

data class PieChartSlice(
    val label: String,
    val value: Float,
    val color: Color,
)

/**
 * Donut-style pie chart for submissions by status.
 */
@Composable
fun PieChart(
    slices: List<PieChartSlice>,
    modifier: Modifier = Modifier,
) {
    if (slices.isEmpty()) return

    val total = slices.sumOf { it.value.toDouble() }.toFloat().coerceAtLeast(1f)
    val description = slices.joinToString(", ") { "${it.label}: ${it.value.toInt()}" }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Pie chart: $description" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Pie
        Canvas(
            modifier = Modifier.size(120.dp),
        ) {
            val strokeWidth = 28.dp.toPx()
            val radius = (size.minDimension - strokeWidth) / 2
            val topLeft = Offset(
                (size.width - radius * 2) / 2,
                (size.height - radius * 2) / 2,
            )
            var startAngle = -90f

            slices.forEach { slice ->
                val sweepAngle = (slice.value / total) * 360f
                drawArc(
                    color = slice.color,
                    startAngle = startAngle,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(radius * 2, radius * 2),
                    style = Stroke(width = strokeWidth),
                )
                startAngle += sweepAngle
            }
        }

        Spacer(Modifier.width(16.dp))

        // Legend
        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            slices.forEach { slice ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Canvas(modifier = Modifier.size(10.dp)) {
                        drawCircle(color = slice.color)
                    }
                    Text(
                        text = "${slice.label} (${slice.value.toInt()})",
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
    }
}
