package com.localsavedmessages.app.ui.screens.folders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.localsavedmessages.app.core.AppResult
import com.localsavedmessages.app.data.repository.FolderRepository
import com.localsavedmessages.app.domain.model.Folder
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class FoldersViewModel(
    private val folderRepository: FolderRepository,
) : ViewModel() {

    val folders: StateFlow<List<Folder>> = folderRepository.observeFolders()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyList(),
        )

    init {
        viewModelScope.launch {
            folderRepository.ensureDefaultFolder()
        }
    }

    fun createFolder(name: String, icon: String, colorIndex: Int) {
        viewModelScope.launch {
            folderRepository.create(name, icon, colorIndex)
        }
    }

    fun renameFolder(id: String, name: String) {
        viewModelScope.launch {
            folderRepository.rename(id, name)
        }
    }

    fun deleteFolder(id: String) {
        viewModelScope.launch {
            folderRepository.delete(id)
        }
    }

    class Factory(
        private val folderRepository: FolderRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            FoldersViewModel(folderRepository) as T
    }
}
