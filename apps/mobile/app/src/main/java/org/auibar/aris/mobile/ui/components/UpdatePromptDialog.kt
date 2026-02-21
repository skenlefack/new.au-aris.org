package org.auibar.aris.mobile.ui.components

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
                    "Update Required"
                } else {
                    "Update Available"
                },
            )
        },
        text = {
            Text(
                text = if (updateInfo.isForceUpdate) {
                    "A critical update is required to continue using ARIS. Please update now."
                } else {
                    "A new version (${updateInfo.latestVersion}) is available."
                },
            )
        },
        confirmButton = {
            Button(onClick = onUpdate) {
                Text("Update Now")
            }
        },
        dismissButton = {
            if (!updateInfo.isForceUpdate) {
                TextButton(onClick = onDismiss) {
                    Text("Later")
                }
            }
        },
    )
}
