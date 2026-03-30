package org.auibar.aris.mobile.ui.trade

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TradeFlowScreen(
    campaignId: String,
    viewModel: TradeFlowViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val countries by viewModel.countryList.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var showDatePicker by remember { mutableStateOf(false) }
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    LaunchedEffect(state.isSaved) {
        if (state.isSaved) {
            val msg = if (state.saveMode == "submit") "Trade flow submitted for sync" else "Trade flow draft saved"
            snackbarHostState.showSnackbar(msg)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.trade_flow)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.saveDraft() }) {
                Icon(Icons.Default.Save, contentDescription = stringResource(R.string.save_draft))
            }
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // Commodity
            FieldLabel(stringResource(R.string.commodity), required = true)
            ExposedDropdownMenuBox(
                expanded = state.commodityExpanded,
                onExpandedChange = { viewModel.toggleCommodityDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedCommodity,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.commodityExpanded) },
                    placeholder = { Text(stringResource(R.string.commodity)) },
                    isError = state.errors.containsKey("commodity"),
                    supportingText = state.errors["commodity"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.commodityExpanded,
                    onDismissRequest = { viewModel.toggleCommodityDropdown() },
                ) {
                    TradeFlowViewModel.commodities.forEach { commodity ->
                        DropdownMenuItem(
                            text = { Text(commodity) },
                            onClick = { viewModel.selectCommodity(commodity) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Origin country
            FieldLabel(stringResource(R.string.origin_country), required = true)
            ExposedDropdownMenuBox(
                expanded = state.originExpanded,
                onExpandedChange = { viewModel.toggleOriginDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedOriginName,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.originExpanded) },
                    placeholder = { Text(stringResource(R.string.origin_country)) },
                    isError = state.errors.containsKey("origin"),
                    supportingText = state.errors["origin"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.originExpanded,
                    onDismissRequest = { viewModel.toggleOriginDropdown() },
                ) {
                    countries.forEach { geo ->
                        DropdownMenuItem(
                            text = { Text(geo.name) },
                            onClick = { viewModel.selectOrigin(geo.id, geo.name) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Destination country
            FieldLabel(stringResource(R.string.destination_country), required = true)
            ExposedDropdownMenuBox(
                expanded = state.destinationExpanded,
                onExpandedChange = { viewModel.toggleDestinationDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedDestinationName,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.destinationExpanded) },
                    placeholder = { Text(stringResource(R.string.destination_country)) },
                    isError = state.errors.containsKey("destination"),
                    supportingText = state.errors["destination"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.destinationExpanded,
                    onDismissRequest = { viewModel.toggleDestinationDropdown() },
                ) {
                    countries.forEach { geo ->
                        DropdownMenuItem(
                            text = { Text(geo.name) },
                            onClick = { viewModel.selectDestination(geo.id, geo.name) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Quantity tonnes
            FieldLabel(stringResource(R.string.quantity_tonnes), required = true)
            OutlinedTextField(
                value = state.quantityTonnes,
                onValueChange = { viewModel.updateQuantityTonnes(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                isError = state.errors.containsKey("quantity"),
                supportingText = state.errors["quantity"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Value USD
            FieldLabel(stringResource(R.string.value_usd))
            OutlinedTextField(
                value = state.valueUsd,
                onValueChange = { viewModel.updateValueUsd(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // SPS Cert Ref
            FieldLabel(stringResource(R.string.sps_cert_ref))
            OutlinedTextField(
                value = state.spsCertRef,
                onValueChange = { viewModel.updateSpsCertRef(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text(stringResource(R.string.sps_cert_ref)) },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Border point
            FieldLabel(stringResource(R.string.border_point))
            OutlinedTextField(
                value = state.borderPoint,
                onValueChange = { viewModel.updateBorderPoint(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text(stringResource(R.string.border_point)) },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Trade date
            FieldLabel(stringResource(R.string.trade_date))
            OutlinedTextField(
                value = state.tradeDate?.let { dateFormat.format(Date(it)) } ?: "",
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.pick_date)) },
                trailingIcon = {
                    IconButton(onClick = { showDatePicker = true }) {
                        Text(stringResource(R.string.cd_pick_date), style = MaterialTheme.typography.labelSmall)
                    }
                },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // GPS capture
            FieldLabel("GPS Location")
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = { viewModel.captureGps() },
                    enabled = !state.isCapturingGps,
                ) {
                    Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text(
                        text = if (state.isCapturingGps) "Capturing..." else stringResource(R.string.capture_location),
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }
                if (state.gpsLat != null) {
                    Text(
                        text = "%.4f, %.4f".format(state.gpsLat, state.gpsLng),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Notes
            FieldLabel("Notes")
            OutlinedTextField(
                value = state.notes,
                onValueChange = { viewModel.updateNotes(it) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5,
                placeholder = { Text("Additional observations...") },
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Submit button
            Button(
                onClick = { viewModel.submit() },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.submit), modifier = Modifier.padding(start = 8.dp))
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = state.tradeDate)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { viewModel.setTradeDate(it) }
                    showDatePicker = false
                }) { Text(stringResource(R.string.confirm)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text(stringResource(R.string.cancel)) }
            },
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

@Composable
private fun FieldLabel(text: String, required: Boolean = false) {
    Row {
        Text(text = text, style = MaterialTheme.typography.labelLarge)
        if (required) {
            Text(text = " *", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelLarge)
        }
    }
    Spacer(modifier = Modifier.height(4.dp))
}
