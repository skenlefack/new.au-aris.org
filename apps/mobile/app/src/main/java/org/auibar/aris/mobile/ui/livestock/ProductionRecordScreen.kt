package org.auibar.aris.mobile.ui.livestock

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductionRecordScreen(
    campaignId: String,
    viewModel: ProductionRecordViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val species by viewModel.speciesList.collectAsStateWithLifecycle(initialValue = emptyList())
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.production_record)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    viewModel.save(campaignId)
                    scope.launch {
                        snackbarHostState.showSnackbar("Production record saved")
                    }
                },
            ) {
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
            Text(
                text = stringResource(R.string.select_species),
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(4.dp))
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
                        .menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.speciesExpanded) },
                    placeholder = { Text(stringResource(R.string.select_species)) },
                )
                ExposedDropdownMenu(
                    expanded = state.speciesExpanded,
                    onDismissRequest = { viewModel.toggleSpeciesDropdown() },
                ) {
                    species.forEach { sp ->
                        DropdownMenuItem(
                            text = { Text(sp.nameEn) },
                            onClick = { viewModel.selectSpecies(sp.id, sp.nameEn) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Product type
            Text(
                text = stringResource(R.string.product_type),
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(4.dp))
            ExposedDropdownMenuBox(
                expanded = state.productExpanded,
                onExpandedChange = { viewModel.toggleProductDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedProduct,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.productExpanded) },
                    placeholder = { Text(stringResource(R.string.product_type)) },
                )
                ExposedDropdownMenu(
                    expanded = state.productExpanded,
                    onDismissRequest = { viewModel.toggleProductDropdown() },
                ) {
                    PRODUCT_TYPES.forEach { product ->
                        DropdownMenuItem(
                            text = { Text(product) },
                            onClick = { viewModel.selectProduct(product) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Quantity
            Text(
                text = stringResource(R.string.quantity),
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = state.quantity,
                onValueChange = { viewModel.updateQuantity(it) },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Unit
            Text(
                text = stringResource(R.string.unit),
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(4.dp))
            ExposedDropdownMenuBox(
                expanded = state.unitExpanded,
                onExpandedChange = { viewModel.toggleUnitDropdown() },
            ) {
                OutlinedTextField(
                    value = state.selectedUnit,
                    onValueChange = {},
                    readOnly = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = state.unitExpanded) },
                    placeholder = { Text(stringResource(R.string.unit)) },
                )
                ExposedDropdownMenu(
                    expanded = state.unitExpanded,
                    onDismissRequest = { viewModel.toggleUnitDropdown() },
                ) {
                    UNITS.forEach { unit ->
                        DropdownMenuItem(
                            text = { Text(unit) },
                            onClick = { viewModel.selectUnit(unit) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

private val PRODUCT_TYPES = listOf(
    "Milk",
    "Meat",
    "Eggs",
    "Wool",
    "Hides & Skins",
    "Honey",
    "Other",
)

private val UNITS = listOf(
    "Litres",
    "Kilograms",
    "Tonnes",
    "Units",
    "Heads",
    "Dozens",
)
