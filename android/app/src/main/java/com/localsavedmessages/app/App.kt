package com.localsavedmessages.app

import android.app.Application
import androidx.room.Room
import com.localsavedmessages.app.data.files.FileStore

class App : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        // A crash during a share leaves staged copies behind. They are useless
        // once the grant is gone, so they are swept at launch.
        container.fileStore.sweepInbox()
    }
}

/** Reaches the container from a composable or an activity. */
val android.content.Context.appContainer: AppContainer
    get() = (applicationContext as App).container
