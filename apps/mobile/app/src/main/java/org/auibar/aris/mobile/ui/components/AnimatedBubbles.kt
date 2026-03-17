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
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import kotlin.math.sin

private data class Bubble(
    val xFraction: Float,
    val yStart: Float,
    val radius: Float,
    val alpha: Float,
    val speed: Float,
    val drift: Float,
)

@Composable
fun AnimatedBubbles(modifier: Modifier = Modifier) {
    val bubbles = remember {
        listOf(
            // Spread bubbles across the full screen with varied sizes and alphas
            Bubble(0.08f, 0.95f, 28f, 0.07f, 18_000f, 30f),
            Bubble(0.22f, 0.85f, 44f, 0.05f, 22_000f, 25f),
            Bubble(0.38f, 1.05f, 20f, 0.09f, 15_000f, 35f),
            Bubble(0.55f, 0.90f, 52f, 0.04f, 25_000f, 20f),
            Bubble(0.72f, 1.10f, 36f, 0.06f, 19_000f, 28f),
            Bubble(0.88f, 0.80f, 24f, 0.08f, 16_000f, 32f),
            Bubble(0.15f, 1.15f, 60f, 0.035f, 28_000f, 18f),
            Bubble(0.45f, 0.75f, 32f, 0.07f, 20_000f, 26f),
            Bubble(0.65f, 1.00f, 48f, 0.045f, 24_000f, 22f),
            Bubble(0.92f, 1.08f, 22f, 0.08f, 17_000f, 34f),
            Bubble(0.30f, 0.70f, 40f, 0.055f, 21_000f, 24f),
            Bubble(0.78f, 0.88f, 56f, 0.04f, 26_000f, 16f),
            Bubble(0.05f, 1.12f, 30f, 0.065f, 19_500f, 30f),
            Bubble(0.50f, 1.18f, 26f, 0.075f, 16_500f, 28f),
        )
    }

    val transition = rememberInfiniteTransition(label = "bubbles")
    val time by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 30_000, easing = LinearEasing),
        ),
        label = "bubbleTime",
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        bubbles.forEach { bubble ->
            // Slow rising movement — bubbles float upward and wrap around
            val riseProgress = (time * 30_000f / bubble.speed) % 1f
            val y = (bubble.yStart - riseProgress * 1.4f) * size.height
            // Wrap: if bubble goes above screen, it comes back from bottom
            val wrappedY = if (y < -bubble.radius * 2) {
                y + size.height + bubble.radius * 4
            } else {
                y
            }

            // Gentle horizontal sine wave drift
            val phase = time * 2f * Math.PI.toFloat() * (30_000f / bubble.speed)
            val offsetX = sin(phase) * bubble.drift

            drawCircle(
                color = Color.White.copy(alpha = bubble.alpha),
                radius = bubble.radius,
                center = androidx.compose.ui.geometry.Offset(
                    x = bubble.xFraction * size.width + offsetX,
                    y = wrappedY,
                ),
            )
        }
    }
}
