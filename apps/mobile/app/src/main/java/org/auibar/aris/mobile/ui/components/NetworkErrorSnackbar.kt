package org.auibar.aris.mobile.ui.components

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.res.stringResource
import org.auibar.aris.mobile.R

@Composable
fun NetworkErrorSnackbar(
    message: String,
    onRetry: () -> Unit,
    snackbarHostState: SnackbarHostState,
) {
    val retryLabel = stringResource(R.string.retry)

    LaunchedEffect(message) {
        if (message.isNotBlank()) {
            val result = snackbarHostState.showSnackbar(
                message = message,
                actionLabel = retryLabel,
                duration = SnackbarDuration.Long,
            )
            if (result == SnackbarResult.ActionPerformed) {
                onRetry()
            }
        }
    }
}
