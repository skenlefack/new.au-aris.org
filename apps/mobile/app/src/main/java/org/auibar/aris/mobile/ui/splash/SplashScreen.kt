package org.auibar.aris.mobile.ui.splash

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.GoldAccent
import org.auibar.aris.mobile.ui.theme.GradientDarkGreen
import org.auibar.aris.mobile.ui.theme.GradientDeepGreen
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal

@Composable
fun SplashScreen(
    onNavigateToDashboard: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToLock: () -> Unit = {},
    viewModel: SplashViewModel = hiltViewModel(),
) {
    var animationStarted by remember { mutableStateOf(false) }

    val alpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(durationMillis = 800),
        label = "splash_alpha",
    )

    val scale by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0.7f,
        animationSpec = tween(durationMillis = 900),
        label = "splash_scale",
    )

    // Spinning loader arc
    val transition = rememberInfiniteTransition(label = "splashLoader")
    val loaderRotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing)),
        label = "loaderSpin",
    )

    // Outer decorative arcs (slow rotating)
    val arcRotation1 by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(10_000, easing = LinearEasing)),
        label = "decorArc1",
    )
    val arcRotation2 by transition.animateFloat(
        initialValue = 360f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(14_000, easing = LinearEasing)),
        label = "decorArc2",
    )

    LaunchedEffect(Unit) {
        animationStarted = true
        delay(2000L)
        if (viewModel.isLoggedIn) {
            viewModel.connectWebSocketIfNeeded()
            if (viewModel.shouldShowLockScreen) {
                onNavigateToLock()
            } else {
                viewModel.recordActivity()
                onNavigateToDashboard()
            }
        } else {
            onNavigateToLogin()
        }
    }

    val splashDesc = stringResource(R.string.cd_splash_loading)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(
                        GradientDeepGreen,
                        GradientDarkGreen,
                        GradientMidGreen,
                        GradientTeal,
                    ),
                    start = Offset.Zero,
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                ),
            )
            .semantics {
                contentDescription = splashDesc
            },
    ) {
        // Decorative rotating arcs behind content
        Canvas(modifier = Modifier.fillMaxSize().alpha(alpha)) {
            val cx = size.width / 2
            val cy = size.height * 0.38f

            // Outer arc
            drawArc(
                color = Color.White.copy(alpha = 0.08f),
                startAngle = arcRotation1,
                sweepAngle = 100f,
                useCenter = false,
                topLeft = Offset(cx - 160f, cy - 160f),
                size = androidx.compose.ui.geometry.Size(320f, 320f),
                style = Stroke(width = 3f, cap = StrokeCap.Round),
            )
            // Inner arc (counter-rotating)
            drawArc(
                color = Color.White.copy(alpha = 0.06f),
                startAngle = arcRotation2,
                sweepAngle = 130f,
                useCenter = false,
                topLeft = Offset(cx - 120f, cy - 120f),
                size = androidx.compose.ui.geometry.Size(240f, 240f),
                style = Stroke(width = 2f, cap = StrokeCap.Round),
            )
        }

        // Main content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .alpha(alpha)
                .scale(scale),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // AU Logo in white circle with shadow
            Box(
                modifier = Modifier
                    .shadow(20.dp, CircleShape)
                    .size(110.dp)
                    .clip(CircleShape)
                    .background(Color.White),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(id = R.drawable.au_logo),
                    contentDescription = stringResource(R.string.cd_au_logo),
                    modifier = Modifier.size(82.dp),
                    contentScale = ContentScale.Fit,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ARIS
            Text(
                text = stringResource(R.string.aris_version),
                style = MaterialTheme.typography.displayMedium.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 6.sp,
                ),
                color = Color.White,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Animal Resources Information System
            Text(
                text = stringResource(R.string.app_subtitle),
                style = MaterialTheme.typography.titleSmall,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(40.dp))

            // Modern loading spinner — gold arc rotating
            Canvas(modifier = Modifier.size(36.dp)) {
                // Background ring (faint)
                drawArc(
                    color = Color.White.copy(alpha = 0.15f),
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
                )
                // Gold spinning arc
                drawArc(
                    color = GoldAccent,
                    startAngle = loaderRotation,
                    sweepAngle = 100f,
                    useCenter = false,
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.loading),
                style = MaterialTheme.typography.labelMedium,
                color = Color.White.copy(alpha = 0.5f),
            )
        }

        // Powered by AU-IBAR at bottom
        Text(
            text = stringResource(R.string.au_ibar_branding),
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.4f),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .alpha(alpha),
        )
    }
}
