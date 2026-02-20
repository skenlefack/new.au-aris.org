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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.auibar.aris.mobile.R

@Composable
fun AppLockScreen(
    onBiometricRequest: () -> Unit,
    onPinVerified: () -> Unit,
    verifyPin: (String) -> Boolean,
    isBiometricAvailable: Boolean,
) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    // Auto-trigger biometric on first load
    LaunchedEffect(Unit) {
        if (isBiometricAvailable) {
            onBiometricRequest()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary,
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = stringResource(R.string.unlock_required),
            style = MaterialTheme.typography.headlineSmall,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.enter_pin),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(modifier = Modifier.height(24.dp))

        // PIN dots
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            repeat(4) { index ->
                PinDot(filled = index < pin.length)
            }
        }

        if (error) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.wrong_pin),
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
                                    if (pin.isNotEmpty()) {
                                        pin = pin.dropLast(1)
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
                                    if (pin.length < 4) {
                                        pin += key
                                        error = false
                                        if (pin.length == 4) {
                                            if (verifyPin(pin)) {
                                                onPinVerified()
                                            } else {
                                                error = true
                                                pin = ""
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

        // Biometric button
        if (isBiometricAvailable) {
            Spacer(modifier = Modifier.height(16.dp))
            TextButton(onClick = onBiometricRequest) {
                Icon(
                    Icons.Default.Fingerprint,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.biometric_prompt_negative))
            }
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
