package org.auibar.aris.mobile.ui.governance

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
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.auibar.aris.mobile.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VetCapacityScreen(
    campaignId: String,
    viewModel: VetCapacityViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val geoList by viewModel.geoList.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.isSaved) {
        if (state.isSaved) {
            val msg = if (state.saveMode == "submit") "Vet capacity submitted for sync" else "Vet capacity draft saved"
            snackbarHostState.showSnackbar(msg)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.vet_capacity)) },
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

            // Facility type dropdown
            FieldLabel(stringResource(R.string.facility_type), required = true)
            ExposedDropdownMenuBox(
                expanded = state.facilityTypeExpanded,
                onExpandedChange = { viewModel.toggleFacilityTypeDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedFacilityType,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.facilityTypeExpanded) },
                    placeholder = { Text(stringResource(R.string.facility_type)) },
                    isError = state.errors.containsKey("facilityType"),
                    supportingText = state.errors["facilityType"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                )
                ExposedDropdownMenu(
                    expanded = state.facilityTypeExpanded,
                    onDismissRequest = { viewModel.toggleFacilityTypeDropdown() },
                ) {
                    VetCapacityViewModel.facilityTypes.forEach { type ->
                        DropdownMenuItem(
                            text = { Text(type) },
                            onClick = { viewModel.selectFacilityType(type) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Staff count
            FieldLabel(stringResource(R.string.staff_count), required = true)
            OutlinedTextField(
                value = state.staffCount,
                onValueChange = { viewModel.updateStaffCount(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                placeholder = { Text("Enter staff count") },
                isError = state.errors.containsKey("staffCount"),
                supportingText = state.errors["staffCount"]?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Equipment level dropdown
            FieldLabel(stringResource(R.string.equipment_level))
            ExposedDropdownMenuBox(
                expanded = state.equipmentLevelExpanded,
                onExpandedChange = { viewModel.toggleEquipmentLevelDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedEquipmentLevel,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.equipmentLevelExpanded) },
                    placeholder = { Text(stringResource(R.string.equipment_level)) },
                )
                ExposedDropdownMenu(
                    expanded = state.equipmentLevelExpanded,
                    onDismissRequest = { viewModel.toggleEquipmentLevelDropdown() },
                ) {
                    VetCapacityViewModel.equipmentLevels.forEach { level ->
                        DropdownMenuItem(
                            text = { Text(level) },
                            onClick = { viewModel.selectEquipmentLevel(level) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Accreditation status dropdown
            FieldLabel(stringResource(R.string.accreditation_status))
            ExposedDropdownMenuBox(
                expanded = state.accreditationStatusExpanded,
                onExpandedChange = { viewModel.toggleAccreditationStatusDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedAccreditationStatus,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.accreditationStatusExpanded) },
                    placeholder = { Text(stringResource(R.string.accreditation_status)) },
                )
                ExposedDropdownMenu(
                    expanded = state.accreditationStatusExpanded,
                    onDismissRequest = { viewModel.toggleAccreditationStatusDropdown() },
                ) {
                    VetCapacityViewModel.accreditationStatuses.forEach { status ->
                        DropdownMenuItem(
                            text = { Text(status) },
                            onClick = { viewModel.selectAccreditationStatus(status) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Location dropdown (GeoDao)
            FieldLabel(stringResource(R.string.location))
            ExposedDropdownMenuBox(
                expanded = state.locationExpanded,
                onExpandedChange = { viewModel.toggleLocationDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedLocationName,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.locationExpanded) },
                    placeholder = { Text("Select admin unit") },
                )
                ExposedDropdownMenu(
                    expanded = state.locationExpanded,
                    onDismissRequest = { viewModel.toggleLocationDropdown() },
                ) {
                    geoList.forEach { geo ->
                        DropdownMenuItem(
                            text = { Text(geo.name) },
                            onClick = { viewModel.selectLocation(geo.id, geo.name) },
                        )
                    }
                }
            }

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
