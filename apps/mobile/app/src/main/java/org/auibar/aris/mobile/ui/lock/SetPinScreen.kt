package org.auibar.aris.mobile.ui.lock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.R

@Composable
fun SetPinScreen(
    onPinSet: (String) -> Unit,
    onBack: () -> Unit,
) {
    var step by remember { mutableIntStateOf(0) } // 0 = enter, 1 = confirm
    var firstPin by remember { mutableStateOf("") }
    var currentPin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    val title = if (step == 0) stringResource(R.string.set_pin) else stringResource(R.string.confirm_pin)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
        )

        Spacer(modifier = Modifier.height(24.dp))

        // PIN dots
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            repeat(4) { index ->
                PinDot(filled = index < currentPin.length)
            }
        }

        if (error) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.pin_mismatch),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Number pad
        val numbers = listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
            listOf("", "0", "DEL"),
        )

        numbers.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                row.forEach { key ->
                    when (key) {
                        "" -> Spacer(modifier = Modifier.size(72.dp))
                        "DEL" -> {
                            IconButton(
                                onClick = {
                                    if (currentPin.isNotEmpty()) {
                                        currentPin = currentPin.dropLast(1)
                                        error = false
                                    }
                                },
                                modifier = Modifier.size(72.dp),
                            ) {
                                Icon(Icons.Default.Backspace, contentDescription = "Delete")
                            }
                        }
                        else -> {
                            Button(
                                onClick = {
                                    if (currentPin.length < 4) {
                                        currentPin += key
                                        error = false
                                        if (currentPin.length == 4) {
                                            if (step == 0) {
                                                firstPin = currentPin
                                                currentPin = ""
                                                step = 1
                                            } else {
                                                if (currentPin == firstPin) {
                                                    onPinSet(currentPin)
                                                } else {
                                                    error = true
                                                    currentPin = ""
                                                }
                                            }
                                        }
                                    }
                                },
                                modifier = Modifier.size(72.dp),
                                shape = CircleShape,
                            ) {
                                Text(
                                    text = key,
                                    style = MaterialTheme.typography.headlineSmall,
                                )
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun PinDot(filled: Boolean) {
    Surface(
        modifier = Modifier.size(16.dp),
        shape = CircleShape,
        color = if (filled) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.outlineVariant
        },
    ) {}
}
