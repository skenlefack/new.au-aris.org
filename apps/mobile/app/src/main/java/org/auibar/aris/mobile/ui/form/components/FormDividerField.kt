package org.auibar.aris.mobile.ui.form.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun FormDividerField(
    modifier: Modifier = Modifier,
) {
    HorizontalDivider(
        modifier = modifier.padding(vertical = 12.dp),
    )
}
