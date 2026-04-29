package org.auibar.aris.mobile.ui.form

import android.Manifest
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.location.LocationServices
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import java.io.File

@Suppress("UNUSED_PARAMETER")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormFillScreen(
    campaignId: String,
    readOnly: Boolean = false,
    onBack: () -> Unit,
    viewModel: FormFillViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.any { it }) {
            val fusedClient = LocationServices.getFusedLocationProviderClient(context)
            try {
                fusedClient.lastLocation.addOnSuccessListener { location ->
                    if (location != null) viewModel.onLocationCaptured(location.latitude, location.longitude, location.accuracy)
                }
            } catch (e: SecurityException) { Log.w("FormFill", "Location denied", e) }
        }
    }

    val photoFile = remember {
        File(context.cacheDir, "photos").apply { mkdirs() }.let { File(it, "photo_${System.currentTimeMillis()}.jpg") }
    }
    val photoUri = remember {
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", photoFile)
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) viewModel.onPhotoCaptured(photoUri.toString())
    }

    val draftSavedMsg = stringResource(R.string.form_saved)
    val submittedMsg = stringResource(R.string.form_submitted)

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                FormEvent.DraftSaved -> snackbarHostState.showSnackbar(draftSavedMsg)
                FormEvent.Submitted -> { snackbarHostState.showSnackbar(submittedMsg); onBack() }
                is FormEvent.Error -> snackbarHostState.showSnackbar(event.message)
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            uiState.templateName.ifBlank { "Form" },
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.titleSmall,
                        )
                        if (readOnly) {
                            Text("Preview", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f))
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = if (readOnly) Color(0xFF1565C0) else MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { padding ->
        if (uiState.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { LoadingSpinner() }
        } else if (uiState.fields.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No form fields available", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    Text(uiState.campaignName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(16.dp))
                    OutlinedButton(onClick = onBack) { Text("Go Back") }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            ) {
                // Campaign name — compact
                Text(
                    uiState.campaignName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )

                // Preview banner
                if (readOnly) {
                    Box(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFF1565C0).copy(alpha = 0.08f)).padding(10.dp),
                    ) {
                        Text("Preview mode — submissions disabled for this campaign.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF1565C0), textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    }
                    Spacer(Modifier.height(8.dp))
                }

                // Form fields
                Box(Modifier.padding(horizontal = 16.dp)) {
                    FormRenderer(
                        fields = uiState.fields,
                        values = uiState.values,
                        errors = uiState.errors,
                        speciesOptions = uiState.speciesOptions,
                        diseaseOptions = uiState.diseaseOptions,
                        countryOptions = uiState.countryOptions,
                        admin1Options = uiState.admin1Options,
                        admin2Options = uiState.admin2Options,
                        masterDataOptions = uiState.masterDataOptions,
                        onValueChange = viewModel::onValueChange,
                        onCaptureLocation = {
                            locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                        },
                        onTakePhoto = { cameraLauncher.launch(photoUri) },
                    )
                }

                Spacer(Modifier.height(16.dp))

                // Action buttons
                Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    if (readOnly) {
                        OutlinedButton(
                            onClick = onBack,
                            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Text("Close Preview", fontWeight = FontWeight.Medium)
                        }
                    } else {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedButton(
                                onClick = viewModel::saveDraft,
                                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Icon(Icons.Default.Save, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text(stringResource(R.string.save_draft))
                            }
                            Button(
                                onClick = viewModel::submit,
                                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text(stringResource(R.string.submit))
                            }
                        }
                    }
                }

                Spacer(Modifier.height(32.dp))
            }
        }
    }
}
