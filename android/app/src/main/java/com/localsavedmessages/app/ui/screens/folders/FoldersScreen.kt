package com.localsavedmessages.app.ui.screens.folders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.FolderOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import com.localsavedmessages.app.ui.components.AppTopBar
import com.localsavedmessages.app.ui.components.EmptyState
import com.localsavedmessages.app.ui.components.Formatters
import com.localsavedmessages.app.ui.components.InsetDivider
import com.localsavedmessages.app.ui.theme.FolderAccents

/**
 * The home screen: the list of folders.
 *
 * The layout follows the Stitch design — a grouped inset list of cards over a
 * flat canvas, each row carrying the folder icon, its name, a preview of the
 * most recent item, when that was, and the item count.
 */
@Composable
fun FoldersScreen(
    folders: List<Folder>,
    onOpenFolder: (String) -> Unit,
    onCreateFolder: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var showCreateField by remember { mutableStateOf(false) }
    var newFolderName by remember { mutableStateOf("") }

    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Surface(color = MaterialTheme.colorScheme.surface) {
                AppTopBar(
                    title = stringResource(R.string.folders_title),
                )
            }
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreateField = !showCreateField },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Default.CreateNewFolder, contentDescription = null)
                Text(
                    text = stringResource(R.string.folders_new),
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            if (showCreateField) {
                NewFolderField(
                    name = newFolderName,
                    onNameChange = { newFolderName = it },
                    onCreate = {
                        onCreateFolder(it)
                        newFolderName = ""
                        showCreateField = false
                    },
                )
                InsetDivider()
            }

            if (folders.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.FolderOff,
                    title = stringResource(R.string.folders_empty_title),
                    body = stringResource(R.string.folders_empty_body),
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(folders, key = { it.id }) { folder ->
                        FolderCard(
                            folder = folder,
                            onClick = { onOpenFolder(folder.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FolderCard(folder: Folder, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        FolderAccents.getOrElse(folder.colorIndex) {
                            FolderAccents.first()
                        }.copy(alpha = 0.14f),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (folder.isVault) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = FolderAccents.getOrElse(folder.colorIndex) {
                            FolderAccents.first()
                        },
                    )
                } else {
                    Text(text = folder.icon, style = MaterialTheme.typography.titleMedium)
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 12.dp, end = 8.dp),
            ) {
                Text(
                    text = folder.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!folder.lastEntryPreview.isNullOrBlank()) {
                    Text(
                        text = folder.lastEntryPreview,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                if (folder.lastEntryAt != null) {
                    Text(
                        text = Formatters.formatTime(folder.lastEntryAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                CountBadge(folder.entryCount)
            }
        }
    }
}

@Composable
private fun CountBadge(count: Int) {
    if (count <= 0) return
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.tertiary)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onTertiary,
        )
    }
}

@Composable
private fun NewFolderField(
    name: String,
    onNameChange: (String) -> Unit,
    onCreate: (String) -> Unit,
) {
    Column(modifier = Modifier.padding(16.dp)) {
        androidx.compose.material3.OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text(stringResource(R.string.folder_name_label)) },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        androidx.compose.material3.Button(
            onClick = { onCreate(name) },
            enabled = name.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text(stringResource(R.string.action_create))
        }
    }
}
