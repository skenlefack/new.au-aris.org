package org.auibar.aris.mobile.ui.sync

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.GlassWhite
import org.auibar.aris.mobile.ui.theme.GoldAccent
import org.auibar.aris.mobile.ui.theme.GoldAccentDark
import org.auibar.aris.mobile.ui.theme.GradientDarkGreen
import org.auibar.aris.mobile.ui.theme.GradientDeepGreen
import org.auibar.aris.mobile.ui.theme.GradientMidGreen
import org.auibar.aris.mobile.ui.theme.GradientTeal
import org.auibar.aris.mobile.ui.theme.SyncFailed
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess

private data class StepConfig(
    val nameRes: Int,
    val icon: ImageVector,
)

private val stepConfigs = listOf(
    StepConfig(R.string.sync_step_geo, Icons.Default.Public),
    StepConfig(R.string.sync_step_species, Icons.Default.Pets),
    StepConfig(R.string.sync_step_diseases, Icons.Default.LocalHospital),
    StepConfig(R.string.sync_step_campaigns, Icons.Default.Campaign),
    StepConfig(R.string.sync_step_templates, Icons.Default.Description),
    StepConfig(R.string.sync_step_refdata, Icons.Default.Storage),
    StepConfig(R.string.sync_step_dashboard, Icons.Default.Dashboard),
)

@Composable
fun InitialSyncScreen(
    onSyncComplete: () -> Unit,
    viewModel: InitialSyncViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // Prevent back navigation
    BackHandler(enabled = true) { /* no-op */ }

    // Start sync automatically
    LaunchedEffect(Unit) {
        viewModel.startSync()
    }

    val animatedProgress by animateFloatAsState(
        targetValue = state.overallProgress,
        animationSpec = tween(durationMillis = 600),
        label = "progress",
    )

    val completedSteps = state.steps.count { it.status == StepStatus.DONE }
    val totalSteps = state.steps.size

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
            ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // AU-IBAR logo (small)
            Box(
                modifier = Modifier
                    .shadow(12.dp, CircleShape)
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(Color.White),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(id = R.drawable.au_logo),
                    contentDescription = stringResource(R.string.cd_au_logo),
                    modifier = Modifier.size(44.dp),
                    contentScale = ContentScale.Fit,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Title
            Text(
                text = stringResource(R.string.sync_setting_up),
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                ),
                color = Color.White,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Subtitle
            Text(
                text = stringResource(R.string.sync_preparing),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Overall progress bar
            LinearProgressIndicator(
                progress = { animatedProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = GoldAccent,
                trackColor = Color.White.copy(alpha = 0.15f),
                strokeCap = StrokeCap.Round,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Step count
            Text(
                text = "$completedSteps/$totalSteps ${stringResource(R.string.sync_completed)}",
                style = MaterialTheme.typography.labelMedium,
                color = GoldAccent,
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Steps list card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(GlassWhite)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                state.steps.forEachIndexed { index, step ->
                    SyncStepRow(
                        config = stepConfigs[index],
                        step = step,
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Continue button (visible when complete)
            if (state.isComplete) {
                Button(
                    onClick = onSyncComplete,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = GoldAccent,
                        contentColor = Color.Black,
                    ),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        text = stringResource(R.string.sync_continue),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                        ),
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
            }

            // Hint at bottom
            Text(
                text = stringResource(R.string.sync_once_hint),
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.4f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp),
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SyncStepRow(
    config: StepConfig,
    step: SyncStep,
) {
    val iconColor by animateColorAsState(
        targetValue = when (step.status) {
            StepStatus.WAITING -> Color.White.copy(alpha = 0.3f)
            StepStatus.IN_PROGRESS -> SyncPending
            StepStatus.DONE -> SyncSuccess
            StepStatus.ERROR -> SyncFailed
        },
        animationSpec = tween(durationMillis = 300),
        label = "stepColor",
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Left icon
        Icon(
            imageVector = config.icon,
            contentDescription = null,
            modifier = Modifier.size(22.dp),
            tint = iconColor,
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Step name
        Text(
            text = stringResource(config.nameRes),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(
                alpha = when (step.status) {
                    StepStatus.WAITING -> 0.5f
                    else -> 0.9f
                },
            ),
            modifier = Modifier.weight(1f),
        )

        Spacer(modifier = Modifier.width(8.dp))

        // Right side: status indicator
        when (step.status) {
            StepStatus.WAITING -> {
                Text(
                    text = stringResource(R.string.sync_waiting),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.3f),
                )
            }

            StepStatus.IN_PROGRESS -> {
                SpinningIndicator()
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.sync_in_progress),
                    style = MaterialTheme.typography.labelSmall,
                    color = SyncPending,
                )
            }

            StepStatus.DONE -> {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = SyncSuccess,
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.sync_step_done, step.count),
                    style = MaterialTheme.typography.labelSmall,
                    color = SyncSuccess,
                )
            }

            StepStatus.ERROR -> {
                Icon(
                    imageVector = Icons.Default.Error,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = SyncFailed,
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = step.errorMessage ?: stringResource(R.string.sync_step_failed),
                    style = MaterialTheme.typography.labelSmall,
                    color = SyncFailed,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun SpinningIndicator() {
    val transition = rememberInfiniteTransition(label = "syncSpin")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing)),
        label = "spin",
    )

    Canvas(modifier = Modifier.size(18.dp)) {
        // Background ring
        drawArc(
            color = Color.White.copy(alpha = 0.15f),
            startAngle = 0f,
            sweepAngle = 360f,
            useCenter = false,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round),
        )
        // Spinning arc
        drawArc(
            color = SyncPending,
            startAngle = rotation,
            sweepAngle = 90f,
            useCenter = false,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round),
        )
    }
}
