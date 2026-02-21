package org.auibar.aris.mobile.ui.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

data class BarChartItem(
    val label: String,
    val value: Float,
    val color: Color,
)

/**
 * Horizontal bar chart for campaign progress or categorical data.
 * Each bar shows label on the left, value on the right, and a filled bar proportional to max.
 */
@Composable
fun HorizontalBarChart(
    items: List<BarChartItem>,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return

    val maxValue = items.maxOf { it.value }.coerceAtLeast(1f)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = "Bar chart with ${items.size} items"
            },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { item ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.label,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.width(80.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(20.dp),
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        // Background bar
                        drawRoundRect(
                            color = Color.LightGray.copy(alpha = 0.3f),
                            cornerRadius = CornerRadius(4.dp.toPx()),
                            size = Size(size.width, size.height),
                        )
                        // Filled bar
                        val fillWidth = (item.value / maxValue) * size.width
                        drawRoundRect(
                            color = item.color,
                            cornerRadius = CornerRadius(4.dp.toPx()),
                            size = Size(fillWidth, size.height),
                        )
                    }
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = item.value.toInt().toString(),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.width(32.dp),
                )
            }
        }
    }
}
