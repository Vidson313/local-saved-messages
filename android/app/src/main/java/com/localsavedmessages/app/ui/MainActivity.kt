package com.localsavedmessages.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.localsavedmessages.app.appContainer
import com.localsavedmessages.app.ui.screens.folders.FoldersScreen
import com.localsavedmessages.app.ui.screens.folders.FoldersViewModel
import com.localsavedmessages.app.ui.theme.LocalSavedMessagesTheme

class MainActivity : ComponentActivity() {

    private val viewModel: FoldersViewModel by viewModels {
        FoldersViewModel.Factory(appContainer.folderRepository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            LocalSavedMessagesTheme {
                val folders by viewModel.folders.collectAsStateWithLifecycle()
                FoldersScreen(
                    folders = folders,
                    onOpenFolder = { /* navigation arrives with the entries screen */ },
                    onCreateFolder = { viewModel.createFolder(it, "📁", 0) },
                )
            }
        }
    }
}
