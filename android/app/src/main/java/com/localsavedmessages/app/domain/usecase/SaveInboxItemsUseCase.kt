package com.localsavedmessages.app.domain.usecase

import androidx.room.withTransaction
import com.localsavedmessages.app.core.AppResult
import com.localsavedmessages.app.core.Clock
import com.localsavedmessages.app.core.Ids
import com.localsavedmessages.app.core.Reason
import com.localsavedmessages.app.data.files.FileStore
import com.localsavedmessages.app.data.local.AppDatabase
import com.localsavedmessages.app.data.local.Mappers.toEntity
import com.localsavedmessages.app.domain.model.Entry
import com.localsavedmessages.app.domain.model.FileCategory
import com.localsavedmessages.app.domain.validation.FileLimits
import com.localsavedmessages.app.domain.validation.FileTypes
import com.localsavedmessages.app.ingestion.FileImporter
import com.localsavedmessages.app.ingestion.InboxItem
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext

/**
 * Commits a share into the archive.
 *
 * The rows are inserted and the staged files are promoted into the permanent
 * store **in the same transaction**, so there is never a permanent file that
 * the database does not know about. If the transaction rolls back, the staged
 * files are swept with the session.
 */
class SaveInboxItemsUseCase(
    private val database: AppDatabase,
    private val fileStore: FileStore,
    private val clock: Clock,
    private val dispatcher: CoroutineDispatcher,
) {

    /**
     * @param staged the files already copied into the staging area
     * @param textItems text shared without a file
     * @param note the user's note, applied to every saved item
     */
    suspend operator fun invoke(
        folderId: String,
        staged: List<FileImporter.Staged>,
        textItems: List<InboxItem.TextItem>,
        note: String,
    ): AppResult<List<Entry>> = withContext(dispatcher) {
        val now = clock.nowMillis()
        val trimmedNote = note.trim().take(FileLimits.MAX_NOTE_LENGTH)

        val entries = mutableListOf<Entry>()

        // A note plus a file is one entry, not two.
        staged.forEach { file ->
            entries += Entry(
                id = Ids.newId(),
                folderId = folderId,
                category = FileTypes.categoryFor(file.mimeType),
                note = trimmedNote,
                body = null,
                filePath = null,
                fileName = file.displayName,
                fileSize = file.sizeBytes,
                mimeType = file.mimeType,
                durationMs = null,
                width = null,
                height = null,
                thumbPath = null,
                pinned = false,
                hidden = false,
                tags = emptyList(),
                createdAt = now,
                updatedAt = now,
            )
        }

        textItems.forEach { item ->
            entries += Entry(
                id = Ids.newId(),
                folderId = folderId,
                category = FileCategory.TEXT,
                note = trimmedNote,
                body = item.text,
                filePath = null,
                fileName = null,
                fileSize = null,
                mimeType = null,
                durationMs = null,
                width = null,
                height = null,
                thumbPath = null,
                pinned = false,
                hidden = false,
                tags = emptyList(),
                createdAt = now,
                updatedAt = now,
            )
        }

        if (entries.isEmpty()) {
            return@withContext AppResult.Failure(Reason.InvalidData("nothing to save"))
        }

        try {
            database.withTransaction {
                // Promote first, so the row can point at the final path.
                val promoted = staged.map { file ->
                    fileStore.promote(file.stagedFile, file.extension) to file
                }

                val finalEntries = entries.mapIndexed { index, entry ->
                    if (index < promoted.size) {
                        entry.copy(filePath = promoted[index].first)
                    } else {
                        entry
                    }
                }

                database.entryDao().insertAll(finalEntries.map { it.toEntity() })
                finalEntries
            }.let { AppResult.Success(it) }
        } catch (e: Exception) {
            AppResult.Failure(Reason.Unknown(e))
        }
    }
}
