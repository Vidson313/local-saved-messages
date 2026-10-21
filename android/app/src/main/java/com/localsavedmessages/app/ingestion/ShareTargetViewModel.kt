package com.localsavedmessages.app.ingestion

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.localsavedmessages.app.core.AppResult
import com.localsavedmessages.app.core.Reason
import com.localsavedmessages.app.data.repository.FolderRepository
import com.localsavedmessages.app.domain.model.Folder
import com.localsavedmessages.app.domain.usecase.SaveInboxItemsUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * State of the share screen.
 *
 * The copy starts as soon as the screen opens, in parallel with the user
 * choosing a folder. By the time they have picked one and typed a note, the
 * file is usually already there.
 */
data class ShareUiState(
    val isLoading: Boolean = true,
    val folders: List<Folder> = emptyList(),
    val selectedFolderId: String? = null,
    val note: String = "",
    val progress: Float? = null,
    val error: ShareError? = null,
    val saved: Boolean = false,
    val savedFolderName: String? = null,
    val savedEntryCount: Int = 0,
    val isSaving: Boolean = false,
    val isCloudLink: Boolean = false,
)

sealed interface ShareError {
    data object NothingShared : ShareError
    data object CopyFailed : ShareError
    data object FileTooLarge : ShareError
    data object StorageFull : ShareError
    data object NoFolderSelected : ShareError
    data class PartialFailure(val count: Int) : ShareError
}

class ShareTargetViewModel(
    private val folderRepository: FolderRepository,
    private val fileImporter: FileImporter,
    private val saveInboxItems: SaveInboxItemsUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShareUiState())
    val uiState: StateFlow<ShareUiState> = _uiState.asStateFlow()

    private val sessionId = java.util.UUID.randomUUID().toString()
    private val staged = mutableListOf<FileImporter.Staged>()
    private val textItems = mutableListOf<InboxItem.TextItem>()
    private var prefilledNote: String? = null
    private var initialised = false

    /**
     * Parses the intent and starts the copy. Safe to call more than once: the
     * second call is ignored.
     */
    fun initialise(result: IntentParser.Result) {
        if (initialised) return
        initialised = true

        viewModelScope.launch {
            folderRepository.ensureDefaultFolder()
            val folders = folderRepository.observeFolders().first()
            val remembered = rememberedFolderId()?.let { folderRepository.findById(it)?.id }

            when (result) {
                is IntentParser.Result.Empty -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        folders = folders,
                        error = ShareError.NothingShared,
                    )
                }

                is IntentParser.Result.Parsed -> {
                    prefilledNote = result.prefilledNote
                    val files = result.items.filterIsInstance<InboxItem.FileItem>()
                    textItems += result.items.filterIsInstance<InboxItem.TextItem>()

                    _uiState.value = _uiState.value.copy(
                        folders = folders,
                        selectedFolderId = remembered ?: folders.firstOrNull()?.id,
                        note = result.prefilledNote.orEmpty(),
                        // A link with no file is a Telegram cloud file the user
                        // has not downloaded yet.
                        isCloudLink = files.isEmpty() && textItems.isNotEmpty(),
                    )

                    files.forEach { file -> stageFile(file) }
                }
            }
        }
    }

    private fun stageFile(file: InboxItem.FileItem) {
        viewModelScope.launch {
            when (
                val outcome = fileImporter.stage(file, sessionId) { written, total ->
                    if (total != null && total > 0) {
                        _uiState.value = _uiState.value.copy(
                            progress = (written.toFloat() / total).coerceIn(0f, 1f),
                        )
                    }
                }
            ) {
                is AppResult.Success -> {
                    staged += outcome.value
                    _uiState.value = _uiState.value.copy(
                        progress = null,
                        isLoading = false,
                    )
                }

                is AppResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        progress = null,
                        isLoading = false,
                        error = when (outcome.reason) {
                            is Reason.FileTooLarge -> ShareError.FileTooLarge
                            Reason.StorageFull -> ShareError.StorageFull
                            else -> ShareError.CopyFailed
                        },
                    )
                }
            }
        }
    }

    fun selectFolder(id: String) {
        _uiState.value = _uiState.value.copy(selectedFolderId = id, error = null)
    }

    fun setNote(note: String) {
        _uiState.value = _uiState.value.copy(note = note)
    }

    fun createFolder(name: String) {
        viewModelScope.launch {
            when (val outcome = folderRepository.create(name, "📁", 0)) {
                is AppResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        folders = folderRepository.observeFolders().first(),
                        selectedFolderId = outcome.value.id,
                    )
                }

                is AppResult.Failure -> Unit
            }
        }
    }

    /** Commits the share. */
    fun save() {
        val state = _uiState.value
        val folderId = state.selectedFolderId
        if (folderId == null) {
            _uiState.value = state.copy(error = ShareError.NoFolderSelected)
            return
        }
        if (state.isSaving) return

        _uiState.value = state.copy(isSaving = true, error = null)

        viewModelScope.launch {
            val outcome = saveInboxItems(
                folderId = folderId,
                staged = staged.toList(),
                textItems = textItems.toList(),
                note = state.note,
            )

            when (outcome) {
                is AppResult.Success -> {
                    val folderName = folderRepository.findById(folderId)?.name
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        saved = true,
                        savedFolderName = folderName,
                        savedEntryCount = outcome.value.size,
                    )
                }

                is AppResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        error = ShareError.CopyFailed,
                    )
                }
            }
        }
    }

    /** Discards the staged copies. Called when the user backs out. */
    fun discard() {
        viewModelScope.launch {
            // The staging directory is swept wholesale at the next launch, so
            // there is nothing to do here beyond dropping the references.
            staged.clear()
            textItems.clear()
        }
    }

    private fun rememberedFolderId(): String? = null


    class Factory(
        private val folderRepository: FolderRepository,
        private val fileImporter: FileImporter,
        private val saveInboxItems: SaveInboxItemsUseCase,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            ShareTargetViewModel(folderRepository, fileImporter, saveInboxItems) as T
    }
}
