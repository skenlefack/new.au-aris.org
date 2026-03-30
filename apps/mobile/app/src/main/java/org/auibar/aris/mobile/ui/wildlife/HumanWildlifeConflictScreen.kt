package org.auibar.aris.mobile.ui.wildlife

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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HumanWildlifeConflictScreen(
    campaignId: String,
    viewModel: HumanWildlifeConflictViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val species by viewModel.speciesList.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showDatePicker by remember { mutableStateOf(false) }
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    LaunchedEffect(state.isSaved) {
        if (state.isSaved) {
            val msg = if (state.saveMode == "submit") "HWC report submitted for sync" else "HWC report draft saved"
            snackbarHostState.showSnackbar(msg)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.hwc_report)) },
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

            // Species selector
            FieldLabel(stringResource(R.string.select_species), required = true)
            ExposedDropdownMenuBox(
                expanded = state.speciesExpanded,
                onExpandedChange = { viewModel.toggleSpeciesDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedSpeciesName,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.speciesExpanded) },
                    placeholder = { Text(stringResource(R.string.select_species)) },
                    isError = state.errors.containsKey("species"),
                    supportingText = state.errors["species"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.speciesExpanded,
                    onDismissRequest = { viewModel.toggleSpeciesDropdown() },
                ) {
                    species.forEach { sp ->
                        DropdownMenuItem(
                            text = { Text(sp.commonName) },
                            onClick = { viewModel.selectSpecies(sp.id, sp.commonName) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Conflict type
            FieldLabel(stringResource(R.string.conflict_type), required = true)
            ExposedDropdownMenuBox(
                expanded = state.conflictTypeExpanded,
                onExpandedChange = { viewModel.toggleConflictTypeDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedConflictType,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.conflictTypeExpanded) },
                    placeholder = { Text(stringResource(R.string.conflict_type)) },
                    isError = state.errors.containsKey("conflictType"),
                    supportingText = state.errors["conflictType"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.conflictTypeExpanded,
                    onDismissRequest = { viewModel.toggleConflictTypeDropdown() },
                ) {
                    viewModel.conflictTypes.forEach { type ->
                        DropdownMenuItem(
                            text = { Text(type) },
                            onClick = { viewModel.selectConflictType(type) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Casualties
            FieldLabel(stringResource(R.string.casualties))
            OutlinedTextField(
                value = state.casualties,
                onValueChange = { viewModel.updateCasualties(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                placeholder = { Text("0") },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Damage estimate USD
            FieldLabel(stringResource(R.string.damage_estimate))
            OutlinedTextField(
                value = state.damageEstimate,
                onValueChange = { viewModel.updateDamageEstimate(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                placeholder = { Text("0.00") },
                prefix = { Text("USD ") },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Mitigation measures
            FieldLabel(stringResource(R.string.mitigation_measures))
            ExposedDropdownMenuBox(
                expanded = state.mitigationExpanded,
                onExpandedChange = { viewModel.toggleMitigationDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedMitigation,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.mitigationExpanded) },
                    placeholder = { Text(stringResource(R.string.mitigation_measures)) },
                )
                ExposedDropdownMenu(
                    expanded = state.mitigationExpanded,
                    onDismissRequest = { viewModel.toggleMitigationDropdown() },
                ) {
                    viewModel.mitigationMeasures.forEach { measure ->
                        DropdownMenuItem(
                            text = { Text(measure) },
                            onClick = { viewModel.selectMitigation(measure) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Incident date
            FieldLabel(stringResource(R.string.incident_date))
            OutlinedTextField(
                value = state.incidentDate?.let { dateFormat.format(Date(it)) } ?: "",
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
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = state.incidentDate)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { viewModel.setIncidentDate(it) }
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
