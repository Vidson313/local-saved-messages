package com.localsavedmessages.app

import android.content.Context
import com.localsavedmessages.app.core.AppDispatchers
import com.localsavedmessages.app.core.Clock
import com.localsavedmessages.app.core.SystemClock
import com.localsavedmessages.app.data.files.FileStore
import com.localsavedmessages.app.data.local.AppDatabase
import com.localsavedmessages.app.data.repository.EntryRepository
import com.localsavedmessages.app.data.repository.FolderRepository
import com.localsavedmessages.app.domain.usecase.SaveInboxItemsUseCase
import com.localsavedmessages.app.ingestion.FileImporter

/**
 * The application's object graph, wired by hand.
 *
 * The graph is small enough — a dozen objects — that an annotation processor
 * would add cost without adding clarity.
 */
class AppContainer(context: Context) {

    private val appContext: Context = context.applicationContext

    val dispatchers: AppDispatchers = AppDispatchers()
    val clock: Clock = SystemClock

    val database: AppDatabase by lazy { AppDatabase.create(appContext) }

    val fileStore: FileStore by lazy { FileStore(appContext.filesDir, appContext.cacheDir) }

    val folderRepository: FolderRepository by lazy {
        FolderRepository(database.folderDao(), database.entryDao(), clock)
    }

    val entryRepository: EntryRepository by lazy {
        EntryRepository(database.entryDao(), fileStore, clock)
    }

    val fileImporter: FileImporter by lazy {
        FileImporter(appContext, fileStore, dispatchers.io)
    }

    val saveInboxItems: SaveInboxItemsUseCase by lazy {
        SaveInboxItemsUseCase(database, fileStore, clock, dispatchers.io)
    }
}
