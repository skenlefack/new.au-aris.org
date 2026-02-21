package org.auibar.aris.mobile.ui.charts

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/**
 * Tiny sparkline chart for embedding in KPI cards.
 * Shows a simple line trend without axes or labels.
 */
@Composable
fun SparklineChart(
    values: List<Float>,
    color: Color,
    modifier: Modifier = Modifier,
) {
    if (values.size < 2) return

    val maxVal = values.max().coerceAtLeast(1f)
    val minVal = values.min().coerceAtLeast(0f)
    val range = (maxVal - minVal).coerceAtLeast(1f)
    val trend = if (values.last() >= values.first()) "upward" else "downward"

    Canvas(
        modifier = modifier.semantics {
            contentDescription = "Sparkline showing $trend trend over ${values.size} points"
        },
    ) {
        val stepX = size.width / (values.size - 1)

        val path = Path()
        values.forEachIndexed { index, value ->
            val x = index * stepX
            val y = size.height * (1 - (value - minVal) / range)
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }

        drawPath(path, color = color, style = Stroke(width = 1.5.dp.toPx()))

        // Draw end dot
        val lastX = (values.size - 1) * stepX
        val lastY = size.height * (1 - (values.last() - minVal) / range)
        drawCircle(color, radius = 2.5.dp.toPx(), center = Offset(lastX, lastY))
    }
}
