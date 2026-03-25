package org.auibar.aris.mobile.ui.photo

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import org.auibar.aris.mobile.ui.components.LoadingSpinner
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import coil.size.Size
import kotlinx.coroutines.launch
import org.auibar.aris.mobile.R
import org.auibar.aris.mobile.data.repository.Photo
import org.auibar.aris.mobile.ui.theme.SyncFailed
import org.auibar.aris.mobile.ui.theme.SyncPending
import org.auibar.aris.mobile.ui.theme.SyncSuccess
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhotoGalleryScreen(
    submissionId: String,
    viewModel: PhotoGalleryViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val photos by viewModel.photos.collectAsStateWithLifecycle(initialValue = emptyList())
    val galleryState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var deleteTarget by remember { mutableStateOf<String?>(null) }

    // Camera launcher
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture(),
    ) { success ->
        if (success && photoUri != null) {
            viewModel.addCapturedPhoto(photoUri!!)
        }
    }

    LaunchedEffect(galleryState.uploadSummary) {
        if (galleryState.uploadSummary.isNotEmpty()) {
            snackbarHostState.showSnackbar(galleryState.uploadSummary)
        }
    }

    val hasFailedPhotos = photos.any { it.uploadStatus == "FAILED" }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.photo_gallery)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back_button))
                    }
                },
                actions = {
                    if (hasFailedPhotos) {
                        IconButton(onClick = { viewModel.retryFailed() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Retry failed uploads")
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    val photoFile = File(context.cacheDir, "photos/capture_${System.currentTimeMillis()}.jpg")
                    photoFile.parentFile?.mkdirs()
                    photoUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", photoFile)
                    cameraLauncher.launch(photoUri!!)
                },
            ) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.add_photo))
            }
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            if (galleryState.isCompressing) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Text(
                    text = stringResource(R.string.compressing_photo),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            if (photos.isNotEmpty()) {
                val uploaded = photos.count { it.uploadStatus == "UPLOADED" }
                val pending = photos.count { it.uploadStatus == "PENDING" || it.uploadStatus == "UPLOADING" }
                val failed = photos.count { it.uploadStatus == "FAILED" }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Text("${photos.size} photos", style = MaterialTheme.typography.labelMedium)
                    if (uploaded > 0) Text("$uploaded uploaded", style = MaterialTheme.typography.labelSmall, color = SyncSuccess)
                    if (pending > 0) Text("$pending pending", style = MaterialTheme.typography.labelSmall, color = SyncPending)
                    if (failed > 0) Text("$failed failed", style = MaterialTheme.typography.labelSmall, color = SyncFailed)
                }
            }

            if (photos.isEmpty() && !galleryState.isCompressing) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = stringResource(R.string.no_photos),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(photos, key = { it.id }) { photo ->
                        PhotoThumbnail(
                            photo = photo,
                            onLongPress = { deleteTarget = photo.id },
                        )
                    }
                }
            }
        }
    }

    deleteTarget?.let { photoId ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete Photo") },
            text = { Text("Remove this photo from the submission?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deletePhoto(photoId)
                    deleteTarget = null
                    scope.launch { snackbarHostState.showSnackbar("Photo deleted") }
                }) { Text(stringResource(R.string.confirm)) }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text(stringResource(R.string.cancel)) }
            },
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PhotoThumbnail(
    photo: Photo,
    onLongPress: () -> Unit,
) {
    Card(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .combinedClickable(onLongClick = onLongPress, onClick = {}),
    ) {
        Box {
            val filePath = photo.thumbnailPath ?: photo.filePath
            val file = File(filePath)

            if (file.exists()) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(file)
                        .size(Size(200, 200))
                        .crossfade(true)
                        .build(),
                    contentDescription = stringResource(R.string.cd_photo),
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                BrokenImagePlaceholder()
            }

            val statusIcon = when (photo.uploadStatus) {
                "UPLOADED" -> Icons.Default.CheckCircle to SyncSuccess
                "UPLOADING" -> null
                "FAILED" -> Icons.Default.Error to SyncFailed
                else -> Icons.Default.CloudUpload to SyncPending
            }

            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(4.dp),
            ) {
                if (photo.uploadStatus == "UPLOADING") {
                    LoadingSpinner(size = 16.dp, strokeWidth = 2.dp)
                } else if (statusIcon != null) {
                    Icon(
                        statusIcon.first,
                        contentDescription = photo.uploadStatus,
                        tint = statusIcon.second,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun BrokenImagePlaceholder() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Default.BrokenImage,
            contentDescription = null,
            modifier = Modifier.size(32.dp),
        )
    }
}
