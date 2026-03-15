package org.auibar.aris.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RemoveCircleOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.theme.QualityFail
import org.auibar.aris.mobile.ui.theme.QualityPass
import org.auibar.aris.mobile.ui.theme.QualityWarn

@Serializable
data class QualityGateResult(
    val gate: String,
    val status: String,
    val score: Int? = null,
    val message: String? = null,
)

data class GateDisplay(
    val labelRes: Int,
    val status: String,
    val score: Int?,
    val message: String?,
)

private val gateLabels = mapOf(
    "completeness" to R.string.quality_completeness,
    "temporal" to R.string.quality_temporal,
    "geographic" to R.string.quality_geographic,
    "codes" to R.string.quality_codes,
    "units" to R.string.quality_units,
    "dedup" to R.string.quality_dedup,
    "audit" to R.string.quality_audit,
    "confidence" to R.string.quality_confidence,
)

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

@Composable
fun QualityGatesCard(
    qualityGateResultsJson: String?,
    modifier: Modifier = Modifier,
) {
    val gates = parseGates(qualityGateResultsJson)

    Card(
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.quality_gates),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )

            if (gates.isEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.quality_no_results),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                val passed = gates.count { it.status == "PASSED" }
                val total = gates.size
                val progress = if (total > 0) passed.toFloat() / total else 0f

                Spacer(Modifier.height(8.dp))

                // Progress summary
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.quality_gates_passed, passed, total),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                    )
                    if (gates.any { it.score != null }) {
                        val avgScore = gates.mapNotNull { it.score }.average().toInt()
                        Text(
                            text = stringResource(R.string.quality_score, avgScore),
                            style = MaterialTheme.typography.labelMedium,
                            color = when {
                                avgScore >= 80 -> QualityPass
                                avgScore >= 50 -> QualityWarn
                                else -> QualityFail
                            },
                        )
                    }
                }

                Spacer(Modifier.height(4.dp))

                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = when {
                        progress >= 0.8f -> QualityPass
                        progress >= 0.5f -> QualityWarn
                        else -> QualityFail
                    },
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )

                Spacer(Modifier.height(12.dp))

                // Individual gates
                gates.forEach { gate ->
                    GateRow(gate)
                    Spacer(Modifier.height(4.dp))
                }
            }
        }
    }
}

@Composable
private fun GateRow(gate: GateDisplay) {
    val (icon, tint) = when (gate.status) {
        "PASSED" -> Icons.Default.CheckCircle to QualityPass
        "FAILED" -> Icons.Default.Cancel to QualityFail
        else -> Icons.Default.RemoveCircleOutline to QualityWarn
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(
                when (gate.status) {
                    "PASSED" -> QualityPass.copy(alpha = 0.06f)
                    "FAILED" -> QualityFail.copy(alpha = 0.06f)
                    else -> QualityWarn.copy(alpha = 0.06f)
                },
            )
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = stringResource(gate.labelRes),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f),
        )
        if (gate.score != null) {
            Text(
                text = "${gate.score}%",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium,
                color = tint,
            )
        }
    }
}

private fun parseGates(jsonStr: String?): List<GateDisplay> {
    if (jsonStr.isNullOrBlank()) return emptyList()
    return try {
        val results = json.decodeFromString<List<QualityGateResult>>(jsonStr)
        results.map { result ->
            GateDisplay(
                labelRes = gateLabels[result.gate] ?: R.string.quality_gates,
                status = result.status,
                score = result.score,
                message = result.message,
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}
