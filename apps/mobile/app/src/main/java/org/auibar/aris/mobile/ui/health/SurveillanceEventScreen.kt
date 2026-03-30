package org.auibar.aris.mobile.ui.health

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
fun SurveillanceEventScreen(
    campaignId: String,
    viewModel: SurveillanceEventViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val species by viewModel.speciesList.collectAsStateWithLifecycle()
    val diseases by viewModel.diseaseList.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showDatePicker by remember { mutableStateOf(false) }
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    LaunchedEffect(state.isSaved) {
        if (state.isSaved) {
            val msg = if (state.saveMode == "submit") "Surveillance event submitted" else "Surveillance draft saved"
            snackbarHostState.showSnackbar(msg)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.surveillance_event)) },
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

            // Surveillance type
            FieldLabel(stringResource(R.string.surveillance_type), required = true)
            ExposedDropdownMenuBox(
                expanded = state.surveillanceTypeExpanded,
                onExpandedChange = { viewModel.toggleSurveillanceTypeDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedSurveillanceType,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.surveillanceTypeExpanded) },
                    placeholder = { Text(stringResource(R.string.surveillance_type)) },
                    isError = state.errors.containsKey("surveillanceType"),
                    supportingText = state.errors["surveillanceType"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.surveillanceTypeExpanded,
                    onDismissRequest = { viewModel.toggleSurveillanceTypeDropdown() },
                ) {
                    viewModel.surveillanceTypes.forEach { type ->
                        DropdownMenuItem(
                            text = { Text(type) },
                            onClick = { viewModel.selectSurveillanceType(type) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Target species
            FieldLabel(stringResource(R.string.target_species), required = true)
            ExposedDropdownMenuBox(
                expanded = state.speciesExpanded,
                onExpandedChange = { viewModel.toggleSpeciesDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedSpeciesName,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
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

            // Disease
            FieldLabel(stringResource(R.string.select_disease), required = true)
            ExposedDropdownMenuBox(
                expanded = state.diseaseExpanded,
                onExpandedChange = { viewModel.toggleDiseaseDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedDiseaseName,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.diseaseExpanded) },
                    placeholder = { Text(stringResource(R.string.select_disease)) },
                    isError = state.errors.containsKey("disease"),
                    supportingText = state.errors["disease"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.diseaseExpanded,
                    onDismissRequest = { viewModel.toggleDiseaseDropdown() },
                ) {
                    diseases.forEach { d ->
                        DropdownMenuItem(
                            text = { Text(d.name) },
                            onClick = { viewModel.selectDisease(d.id, d.name) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Sample count
            FieldLabel(stringResource(R.string.sample_count), required = true)
            OutlinedTextField(
                value = state.sampleCount,
                onValueChange = { viewModel.updateSampleCount(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                isError = state.errors.containsKey("sampleCount"),
                supportingText = state.errors["sampleCount"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Result
            FieldLabel(stringResource(R.string.result))
            ExposedDropdownMenuBox(
                expanded = state.resultExpanded,
                onExpandedChange = { viewModel.toggleResultDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedResult,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.resultExpanded) },
                    placeholder = { Text(stringResource(R.string.result)) },
                )
                ExposedDropdownMenu(
                    expanded = state.resultExpanded,
                    onDismissRequest = { viewModel.toggleResultDropdown() },
                ) {
                    viewModel.resultOptions.forEach { result ->
                        DropdownMenuItem(
                            text = { Text(result) },
                            onClick = { viewModel.selectResult(result) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Lab reference
            FieldLabel(stringResource(R.string.lab_reference))
            OutlinedTextField(
                value = state.labReference,
                onValueChange = { viewModel.updateLabReference(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Event date
            FieldLabel(stringResource(R.string.event_date))
            OutlinedTextField(
                value = state.eventDate?.let { dateFormat.format(Date(it)) } ?: "",
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
            FieldLabel(stringResource(R.string.gps_location))
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
            FieldLabel(stringResource(R.string.notes))
            OutlinedTextField(
                value = state.notes,
                onValueChange = { viewModel.updateNotes(it) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5,
                placeholder = { Text("Additional observations...") },
            )

            Spacer(modifier = Modifier.height(24.dp))

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
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = state.eventDate)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { viewModel.setEventDate(it) }
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
