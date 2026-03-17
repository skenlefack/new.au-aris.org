package org.auibar.aris.mobile.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import org.auibar.aris.mobile.ui.theme.GradientDarkGreen
import org.auibar.aris.mobile.ui.theme.GradientDeepGreen
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun GradientBackground(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "gradient")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 20_000, easing = LinearEasing),
        ),
        label = "gradientAngle",
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        val rad = Math.toRadians(angle.toDouble())
        val cx = size.width / 2
        val cy = size.height / 2
        val radius = maxOf(size.width, size.height)

        val startX = cx + (cos(rad) * radius).toFloat()
        val startY = cy + (sin(rad) * radius).toFloat()
        val endX = cx - (cos(rad) * radius).toFloat()
        val endY = cy - (sin(rad) * radius).toFloat()

        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    GradientDarkGreen,
                    GradientMidGreen,
                    GradientTeal,
                    GradientDeepGreen,
                ),
                start = Offset(startX, startY),
                end = Offset(endX, endY),
            ),
        )
    }
}
