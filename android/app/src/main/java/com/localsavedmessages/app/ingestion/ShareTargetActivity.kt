package com.localsavedmessages.app.ingestion

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.localsavedmessages.app.appContainer
import com.localsavedmessages.app.ui.screens.inbox.ShareTargetScreen
import com.localsavedmessages.app.ui.theme.LocalSavedMessagesTheme

/**
 * The activity that receives a share.
 *
 * It is deliberately separate from the main activity: it has to finish
 * immediately and hand the user back to the app they came from.
 */
class ShareTargetActivity : ComponentActivity() {

    private val viewModel: ShareTargetViewModel by viewModels {
        val container = appContainer
        ShareTargetViewModel.Factory(
            folderRepository = container.folderRepository,
            fileImporter = container.fileImporter,
            saveInboxItems = container.saveInboxItems,
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val result = IntentParser.parse(intent, contentResolver)
        viewModel.initialise(result)

        setContent {
            LocalSavedMessagesTheme {
                val state by viewModel.uiState.collectAsStateWithLifecycle()
                ShareTargetScreen(
                    state = state,
                    onSelectFolder = viewModel::selectFolder,
                    onNoteChange = viewModel::setNote,
                    onCreateFolder = viewModel::createFolder,
                    onSave = viewModel::save,
                    onDismiss = { finishWithCancel() },
                    onDone = { finishWithSuccess() },
                )
            }
        }
    }

    override fun onDestroy() {
        if (isFinishing && !savedSuccessfully) {
            viewModel.discard()
        }
        super.onDestroy()
    }

    private var savedSuccessfully = false

    private fun finishWithSuccess() {
        savedSuccessfully = true
        setResult(RESULT_OK, Intent().putExtra(EXTRA_SAVED_COUNT, viewModel.uiState.value.savedEntryCount))
        finish()
    }

    private fun finishWithCancel() {
        setResult(RESULT_CANCELED)
        finish()
    }

    companion object {
        const val EXTRA_SAVED_COUNT = "saved_count"
    }
}
