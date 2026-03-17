package org.auibar.aris.mobile.ui.components

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.util.UpdateInfo

@Composable
fun UpdatePromptDialog(
    updateInfo: UpdateInfo,
    onUpdate: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = {
            if (!updateInfo.isForceUpdate) onDismiss()
        },
        title = {
            Text(
                text = if (updateInfo.isForceUpdate) {
                    stringResource(R.string.update_required)
                } else {
                    stringResource(R.string.update_available)
                },
            )
        },
        text = {
            Text(
                text = if (updateInfo.isForceUpdate) {
                    stringResource(R.string.update_required_message)
                } else {
                    stringResource(R.string.update_message, updateInfo.latestVersion)
                },
            )
        },
        confirmButton = {
            Button(onClick = onUpdate) {
                Text(stringResource(R.string.update_now))
            }
        },
        dismissButton = {
            if (!updateInfo.isForceUpdate) {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(R.string.update_later))
                }
            }
        },
    )
}
