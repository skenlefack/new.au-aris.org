package org.auibar.aris.mobile.ui.components

import androidx.compose.animation.animateColorAsState
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.WorkflowLevel1
import org.auibar.aris.mobile.ui.theme.WorkflowLevel2
import org.auibar.aris.mobile.ui.theme.WorkflowLevel3
import org.auibar.aris.mobile.ui.theme.WorkflowLevel4

data class WorkflowStep(
    val level: Int,
    val labelRes: Int,
    val color: Color,
    val status: StepStatus,
)

enum class StepStatus { NOT_STARTED, PENDING, APPROVED, REJECTED }

@Composable
fun WorkflowStatusBar(
    currentLevel: Int,
    workflowStatus: String?,
    modifier: Modifier = Modifier,
) {
    val steps = buildSteps(currentLevel, workflowStatus)

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.workflow_status),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            steps.forEachIndexed { index, step ->
                WorkflowStepItem(
                    step = step,
                    modifier = Modifier.weight(1f),
                )
                if (index < steps.lastIndex) {
                    StepConnector(
                        isCompleted = step.status == StepStatus.APPROVED,
                        color = step.color,
                        modifier = Modifier
                            .weight(0.5f)
                            .padding(top = 14.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun WorkflowStepItem(
    step: WorkflowStep,
    modifier: Modifier = Modifier,
) {
    val bgColor by animateColorAsState(
        targetValue = when (step.status) {
            StepStatus.APPROVED -> step.color
            StepStatus.PENDING -> step.color.copy(alpha = 0.3f)
            StepStatus.REJECTED -> MaterialTheme.colorScheme.error
            StepStatus.NOT_STARTED -> MaterialTheme.colorScheme.outlineVariant
        },
        label = "stepBg",
    )

    val iconTint = when (step.status) {
        StepStatus.APPROVED, StepStatus.REJECTED -> Color.White
        else -> step.color
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(bgColor),
            contentAlignment = Alignment.Center,
        ) {
            when (step.status) {
                StepStatus.APPROVED -> Icon(
                    Icons.Default.Check,
                    contentDescription = stringResource(R.string.workflow_approved),
                    tint = iconTint,
                    modifier = Modifier.size(16.dp),
                )
                StepStatus.REJECTED -> Icon(
                    Icons.Default.Close,
                    contentDescription = stringResource(R.string.workflow_rejected),
                    tint = iconTint,
                    modifier = Modifier.size(16.dp),
                )
                StepStatus.PENDING -> Icon(
                    Icons.Default.HourglassEmpty,
                    contentDescription = stringResource(R.string.workflow_pending),
                    tint = iconTint,
                    modifier = Modifier.size(16.dp),
                )
                StepStatus.NOT_STARTED -> Text(
                    text = "${step.level}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        Text(
            text = stringResource(step.labelRes),
            style = MaterialTheme.typography.labelSmall,
            textAlign = TextAlign.Center,
            maxLines = 2,
            lineHeight = MaterialTheme.typography.labelSmall.lineHeight,
        )
    }
}

@Composable
private fun StepConnector(
    isCompleted: Boolean,
    color: Color,
    modifier: Modifier = Modifier,
) {
    val lineColor by animateColorAsState(
        targetValue = if (isCompleted) color else MaterialTheme.colorScheme.outlineVariant,
        label = "connectorColor",
    )

    HorizontalDivider(
        modifier = modifier,
        thickness = 2.dp,
        color = lineColor,
    )
}

private fun buildSteps(currentLevel: Int, workflowStatus: String?): List<WorkflowStep> {
    val levels = listOf(
        Triple(1, R.string.workflow_level_1, WorkflowLevel1),
        Triple(2, R.string.workflow_level_2, WorkflowLevel2),
        Triple(3, R.string.workflow_level_3, WorkflowLevel3),
        Triple(4, R.string.workflow_level_4, WorkflowLevel4),
    )

    return levels.map { (level, labelRes, color) ->
        val status = when {
            level < currentLevel -> StepStatus.APPROVED
            level == currentLevel -> when (workflowStatus) {
                "APPROVED" -> StepStatus.APPROVED
                "REJECTED" -> StepStatus.REJECTED
                "PENDING" -> StepStatus.PENDING
                else -> StepStatus.PENDING
            }
            else -> StepStatus.NOT_STARTED
        }
        WorkflowStep(level = level, labelRes = labelRes, color = color, status = status)
    }
}
