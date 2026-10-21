package com.localsavedmessages.app.ui.screens.inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.NoteAdd
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.localsavedmessages.app.R
import com.localsavedmessages.app.domain.model.Folder
import com.localsavedmessages.app.ingestion.ShareError
import com.localsavedmessages.app.ingestion.ShareUiState
import com.localsavedmessages.app.ui.components.AppTopBar
import com.localsavedmessages.app.ui.components.InsetDivider

/**
 * The save screen: a preview of what was shared, an optional note, and the
 * list of folders to save into.
 *
 * This screen is not part of the main navigation. It opens from the system
 * share sheet and finishes back to whatever the user came from.
 */
@Composable
fun ShareTargetScreen(
    state: ShareUiState,
    onSelectFolder: (String) -> Unit,
    onNoteChange: (String) -> Unit,
    onCreateFolder: (String) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
    onDone: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(
                title = stringResource(R.string.share_title),
                onBack = onDismiss,
            )

            if (state.saved) {
                SavedConfirmation(
                    folderName = state.savedFolderName.orEmpty(),
                    count = state.savedEntryCount,
                    onView = onDone,
                    onDismiss = onDismiss,
                )
                return@Column
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { PreviewCard(state) }

                if (state.isCloudLink) {
                    item { CloudLinkNotice() }
                }

                item {
                    OutlinedTextField(
                        value = state.note,
                        onValueChange = onNoteChange,
                        label = { Text(stringResource(R.string.share_note_label)) },
                        placeholder = { Text(stringResource(R.string.share_note_hint)) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        minLines = 2,
                        maxLines = 5,
                    )
                }

                item {
                    Text(
                        text = stringResource(R.string.share_destination_label),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }

                items(state.folders, key = { it.id }) { folder ->
                    FolderRow(
                        folder = folder,
                        selected = folder.id == state.selectedFolderId,
                        onClick = { onSelectFolder(folder.id) },
                    )
                }

                item {
                    NewFolderRow(onCreate = onCreateFolder)
                }
            }

            SaveBar(
                state = state,
                onSave = onSave,
            )
        }
    }
}

@Composable
private fun PreviewCard(state: ShareUiState) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            state.progress?.let { progress ->
                Text(
                    text = stringResource(R.string.share_copying, (progress * 100).toInt()),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Default.NoteAdd,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 12.dp),
                ) {
                    Text(
                        text = stringResource(R.string.share_destination_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = stringResource(R.string.app_name),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun CloudLinkNotice() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer,
    ) {
        Row(modifier = Modifier.padding(16.dp)) {
            Icon(
                imageVector = Icons.Default.CloudOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onTertiaryContainer,
            )
            Column(modifier = Modifier.padding(start = 12.dp)) {
                Text(
                    text = stringResource(R.string.share_cloud_file_title),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                )
                Text(
                    text = stringResource(R.string.share_cloud_file_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun FolderRow(
    folder: Folder,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val background = if (selected) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surface
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = background,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.Center,
            ) {
                if (folder.isVault) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                } else {
                    Text(text = folder.icon, style = MaterialTheme.typography.titleMedium)
                }
            }

            Text(
                text = folder.name,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 12.dp),
            )
        }
    }
}

@Composable
private fun NewFolderRow(onCreate: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }

    if (!expanded) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = true }
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Default.CreateNewFolder,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = stringResource(R.string.share_new_folder),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 12.dp),
            )
        }
        return
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text(stringResource(R.string.folder_name_label)) },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.weight(1f),
        )
        Button(
            onClick = {
                onCreate(name)
                name = ""
                expanded = false
            },
            enabled = name.isNotBlank(),
            modifier = Modifier.padding(start = 8.dp),
        ) {
            Text(stringResource(R.string.action_create))
        }
    }
}

@Composable
private fun SaveBar(state: ShareUiState, onSave: () -> Unit) {
    Column {
        InsetDivider()
        Column(modifier = Modifier.padding(16.dp)) {
            state.error?.let { error ->
                Text(
                    text = when (error) {
                        ShareError.NothingShared -> stringResource(R.string.share_nothing_shared)
                        ShareError.CopyFailed -> stringResource(R.string.share_copy_failed)
                        ShareError.FileTooLarge -> stringResource(R.string.error_file_too_large)
                        ShareError.StorageFull -> stringResource(R.string.error_storage_full)
                        ShareError.NoFolderSelected -> stringResource(R.string.share_destination_label)
                        is ShareError.PartialFailure -> stringResource(
                            R.string.share_partial_failure,
                            error.count.toString(),
                        )
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }

            Button(
                onClick = onSave,
                enabled = !state.isSaving && state.selectedFolderId != null,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                if (state.isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text(stringResource(R.string.share_action))
                }
            }
        }
    }
}

@Composable
private fun SavedConfirmation(
    folderName: String,
    count: Int,
    onView: () -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Default.Folder,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.tertiary,
            modifier = Modifier.size(48.dp),
        )
        Text(
            text = stringResource(R.string.share_saved, folderName),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Button(
            onClick = onView,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp)
                .height(52.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Text(stringResource(R.string.share_view))
        }
        Text(
            text = stringResource(R.string.action_cancel),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .clickable(onClick = onDismiss)
                .padding(16.dp),
        )
    }
}
