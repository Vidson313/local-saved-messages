# 02 — Architecture

## 1. Layer diagram

```
┌────────────────────────────────────────────────────────────┐
│  ui/            Compose screens, ViewModels, navigation     │
│                 StateFlow<UiState> per screen               │
├────────────────────────────────────────────────────────────┤
│  domain/        Pure Kotlin: models, use cases              │
│                 No Android framework types leak in here      │
├────────────────────────────────────────────────────────────┤
│  ingestion/     Share-target intent parsing, file import    │
│                 The one place that touches an inbound Intent │
├────────────────────────────────────────────────────────────┤
│  data/                                                        │
│    repository/  Single source of truth per domain area       │
│                 Exposes Flow<T> to the UI, suspend fns        │
│      ├── local/    Room: entities, DAOs, migrations          │
│      └── files/    App-private file storage, thumbnails,     │
│                   zip export/import                           │
├────────────────────────────────────────────────────────────┤
│  core/          Result, dispatchers, logging, time, ids      │
└────────────────────────────────────────────────────────────┘
```

**Rules**

- The UI never touches `data/local` or `data/files` directly. It only sees
  repository objects.
- `ingestion/` is the **only** place that reads an inbound `Intent`. It
  produces a domain-level `InboxItem` list; everything downstream is
  oblivious to where the content came from.
- `domain/` has **zero** Android imports except `java.io.File` and
  `android.net.Uri` in the file-handling interfaces, which are declared as
  abstractions so the layer stays testable on the JVM.

## 2. Package layout

```
com.localsavedmessages.app
├── core
│   ├── AppResult.kt          sealed Result<T> — Success / Failure(Reason)
│   ├── Dispatchers.kt        IO / Default / Main providers
│   ├── Clock.kt              injectable time source
│   ├── Ids.kt                client-side UUID generation
│   └── Logger.kt             Logcat + optional file log
├── domain
│   ├── model
│   │   ├── Folder.kt         a "chat" / destination
│   │   ├── Entry.kt          a saved item (text, file, or both)
│   │   ├── EntryType.kt
│   │   ├── Tag.kt
│   │   └── SortOrder.kt
│   ├── usecase
│   │   ├── ObserveFoldersUseCase
│   │   ├── ObserveEntriesUseCase
│   │   ├── CreateFolderUseCase
│   │   ├── RenameFolderUseCase
│   │   ├── DeleteFolderUseCase
│   │   ├── SaveInboxItemsUseCase
│   │   ├── DeleteEntryUseCase
│   │   ├── MoveEntryUseCase
│   │   ├── TogglePinUseCase
│   │   ├── SetTagsUseCase
│   │   ├── SearchEntriesUseCase
│   │   └── ExportArchiveUseCase / ImportArchiveUseCase
│   └── validation
│       ├── EntryValidator.kt
│       └── FileLimits.kt
├── ingestion
│   ├── ShareTargetActivity.kt      the launcher that receives the Intent
│   ├── IntentParser.kt             Intent → List<InboxItem>
│   ├── InboxItem.kt                sealed: Text / File / Stream
│   └── FileImporter.kt             copies a content:// URI into app storage
├── data
│   ├── local
│   │   ├── entity/  FolderEntity, EntryEntity, TagEntity, EntryTagCrossRef
│   │   ├── dao/     FolderDao, EntryDao, TagDao
│   │   ├── AppDatabase.kt
│   │   └── Converters.kt
│   ├── files
│   │   ├── FileStore.kt            app-private storage layout
│   │   ├── Thumbnailer.kt          image/video thumbnails
│   │   ├── ArchiveExporter.kt      zip writer
│   │   └── ArchiveImporter.kt      zip reader
│   └── repository
│       ├── FolderRepository.kt
│       ├── EntryRepository.kt
│       └── SettingsRepository.kt
└── ui
    ├── theme/       Color.kt, Type.kt, Theme.kt, Dimens.kt
    ├── components/  EntryBubble, FolderRow, SearchField, TagChip, …
    ├── navigation/  NavGraph.kt, Routes.kt
    └── screens/
        ├── inbox/    InboxActivity (share landing), FolderPickerSheet
        ├── folders/  FoldersScreen
        ├── entries/  EntriesScreen, EntryDetailScreen
        ├── search/   SearchScreen
        ├── media/    MediaGalleryScreen
        └── settings/ SettingsScreen
```

## 3. Data flow — the share path

This is the single most important flow in the app. It is written out in full
because it is where the correctness traps live.

```
Telegram (or any app)
   │  ACTION_SEND / ACTION_SEND_MULTIPLE
   ▼
ShareTargetActivity                      ← a dedicated Activity, not the main one
   │
   ├─ 1. Parse the Intent
   │      EXTRA_STREAM  → list of content:// URIs
   │      EXTRA_TEXT    → possibly a text body
   │      ClipData      → the multi-item case
   │
   ├─ 2. Ask for (and hold) a read permission on each URI
   │      takePersistableUriPermission is NOT available here →
   │      the grant lasts only for this Activity's lifetime
   │      ⇒ we MUST copy the bytes NOW, not later
   │
   ├─ 3. Copy every file into app-private storage
   │      FileImporter → files/<yyyy>/<mm>/<uuid>.<ext>
   │      (streaming; a 2 GB video must not be buffered in memory)
   │
   ├─ 4. Show the FolderPicker
   │      previews the file, an optional note field, a folder list
   │
   ├─ 5. On confirm → SaveInboxItemsUseCase
   │      one transaction: insert Entry rows + tag rows
   │
   └─ 6. Finish
          show a snackbar ("Saved to <folder>") with a "View" action,
          then finish() back to the source app
```

**Why the copy in step 3 is non-negotiable**

A `content://` URI handed to an app by a share intent is backed by a
**temporary, per-URI grant** tied to the receiving activity. If the app stores
the URI string and tries to open it later, the grant is gone and the read
fails with `SecurityException`. Telegram's own media cache is additionally
evicted aggressively.

So: **the bytes are copied into app-private storage during the share
activity's lifetime.** Everything the user sees afterwards points at the local
copy.

### 3.1 Failure handling in the share path

| Failure | Behaviour |
|---------|-----------|
| A file cannot be read (revoked grant, deleted source) | That item is skipped; the others still save. The screen lists what failed and why. |
| All items fail | An error state with "Return to Telegram" and "Try again". |
| The source provides a **text** only | The entry is saved as a text entry. |
| The source provides a **stream** that is not a file (e.g. an intent with a huge inline body) | The body is written to a text file; if it is text, it becomes a text entry. |
| The source provides a **web link** (`text/plain` with a URL) | It is saved as a text entry containing the link. The user can tap it to open the browser. |
| The picker is cancelled | Nothing is saved; the activity finishes with `RESULT_CANCELED`. No orphaned files — the copy step writes into a temp area that is deleted on cancel. |

**Temp-area rule:** step 3 writes into `cache/inbox/<sessionId>/`. On confirm,
the files are *moved* into `files/`. On cancel or crash, `cache/inbox/` is
wiped on the next launch. A crash mid-copy must not leave files in the
permanent store that the database does not know about.

## 4. Repository pattern

### 4.1 Read path — always local

```kotlin
class EntryRepository(private val entryDao: EntryDao) {

    /** Emits the entries of a folder, newest first. Room re-emits on any write. */
    fun observeEntries(folderId: String, sort: SortOrder): Flow<List<Entry>> =
        entryDao.observeByFolder(folderId, sort)
            .map { rows -> rows.map { it.toDomain() } }
```

The UI collects a `Flow` and never awaits anything. A write to Room causes an
invalidation, Room re-queries, and the `Flow` emits. The UI has no idea
whether the change came from a share intent, a deletion, or an import.

### 4.2 Write path

```kotlin
class SaveInboxItemsUseCase(
    private val entryDao: EntryDao,
    private val tagDao: TagDao,
    private val fileStore: FileStore,
    private val clock: Clock,
) {
    suspend operator fun invoke(
        folderId: String,
        items: List<InboxItem>,
        note: String?,
    ): AppResult<List<Entry>> = withContext(dispatchers.io) {
        // One transaction: the entries and their tags land together or not at all.
        val entries = items.map { it.toEntry(folderId, note, clock.now()) }
        db.withTransaction {
            entryDao.insertAll(entries)
            tagDao.applyTags(entries)
            fileStore.promote(items)   // move out of cache/inbox into files/
        }
        AppResult.Success(entries)
    }
}
```

`AppResult.Success` means *"written to the local database"* — the app has no
network, so there is no second meaning.

### 4.3 Delete with undo

Deletion is **deferred**, not compensated:

```kotlin
// The row is marked hidden and a timer starts.
suspend fun softDelete(id: String)   // row.hidden = 1, hidden_at = now
suspend fun confirmDelete(id: String) // row is really deleted, file removed
suspend fun undoDelete(id: String)    // row.hidden = 0
```

A `WorkManager` job (or a `Handler` post) confirms the deletion after 5
seconds. A snackbar offers "Undo" for the same window. Because the app is
local, this is free — there is no server round-trip to make the delete
irreversible.

The file on disk is deleted only on confirm, and only if no other entry
references the same stored file (see [03-local-data.md](03-local-data.md) §4).

## 5. Error handling model

```kotlin
sealed interface AppResult<out T> {
    data class Success<T>(val value: T) : AppResult<T>
    data class Failure(val reason: Reason) : AppResult<Nothing>
}

sealed interface Reason {
    data object StorageFull : Reason
    data object PermissionDenied : Reason
    data object SourceUnavailable : Reason   // the shared file vanished
    data class InvalidData(val detail: String) : Reason
    data class Unknown(val cause: Throwable) : Reason
}
```

There is no `Offline` reason, because there is no network. There is no
`Http(code)` reason, because there is no HTTP. The failure vocabulary is
small and specific to a local app, and every reason maps to a distinct,
actionable user message.

## 6. Threading model

| Work | Dispatcher |
|-------|-----------|
| File copy, zip, thumbnails | `Dispatchers.IO` |
| DB queries and transactions | Room's own executor; `Flow` collection on `Main` |
| Search (FTS query + formatting) | `Dispatchers.Default` |
| Share intent parsing | `Dispatchers.Main` (it is fast; only the copy is off-thread) |

The share activity shows a determinate progress bar for the copy step, because
copying a 2 GB video from Telegram is genuinely slow and the user needs to know
what is happening.

## 7. Dependency injection

```kotlin
class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    val database by lazy { AppDatabase.create(appContext) }
    val fileStore by lazy { FileStore(appContext.filesDir, appContext.cacheDir) }
    val thumbnailer by lazy { Thumbnailer(appContext) }
    val folderRepository by lazy { FolderRepository(database.folderDao()) }
    val entryRepository by lazy { EntryRepository(database.entryDao(), database.tagDao()) }
    val settingsRepository by lazy { SettingsRepository(DataStore) }
    val inboxViewModelFactory by lazy { InboxViewModelFactory(this) }
}
```

Exposed through a `CompositionLocal` in the root composable. No Hilt.

## 8. Manifest — permissions and components

```xml
<manifest>

  <!-- NO android.permission.INTERNET. The app is offline-only. -->

  <application
      android:name=".App"
      android:allowBackup="false"          <!-- the archive never goes to a cloud backup -->
      android:fullBackupContent="false"
      android:dataExtractionRules="@xml/data_extraction_rules"
      android:icon="@mipmap/ic_launcher"
      android:theme="@style/Theme.LocalSavedMessages"
      android:supportsRtl="true">

    <activity
        android:name=".ingestion.ShareTargetActivity"
        android:exported="true"
        android:label="@string/app_name"
        android:theme="@style/Theme.LocalSavedMessages.Splash"
        android:launchMode="singleTask">
      <intent-filter>
        <action android:name="android.intent.action.SEND" />
        <category android:name="android.intent.category.DEFAULT" />
        <data android:mimeType="text/*" />
        <data android:mimeType="image/*" />
        <data android:mimeType="video/*" />
        <data android:mimeType="audio/*" />
        <data android:mimeType="application/*" />
      </intent-filter>

      <intent-filter>
        <action android:name="android.intent.action.SEND_MULTIPLE" />
        <category android:name="android.intent.category.DEFAULT" />
        <data android:mimeType="image/*" />
        <data android:mimeType="video/*" />
        <data android:mimeType="audio/*" />
        <data android:mimeType="application/*" />
      </intent-filter>
    </activity>

    <activity android:name=".ui.MainActivity" android:exported="true" />

    <!-- Exposes stored attachments to other apps for the "share out" flow. -->
    <provider
        android:name="androidx.core.content.FileProvider"
        android:authorities="${applicationId}.fileprovider"
        android:exported="false"
        android:grantUriPermissions="true">
      <meta-data
          android:name="android.support.FILE_PROVIDER_PATHS"
          android:resource="@xml/file_paths" />
    </provider>
  </application>
</manifest>
```

Notes:

- **`allowBackup="false"`** is deliberate. A Bazaar install *is* eligible for
  Android Auto Backup (unlike a sideloaded one), and silently uploading a
  personal archive to the user's cloud backup is not something they asked
  for. Export/import is the supported path — see
  [03-local-data.md](03-local-data.md) §5.
- **No `READ_EXTERNAL_STORAGE` / `READ_MEDIA_*`.** The app never reads the
  shared library directly; it only reads what other apps hand it through the
  share intent, which needs no permission.
- **`supportsRtl="true"`** is required for the Persian layout to mirror.
- `android:launchMode="singleTask"` on the share activity prevents a pile of
  duplicate activities when several items are shared in a row.
- The app is `exported="true"` only for the share activity and the launcher.
- The `FileProvider` is `exported="false"` and grants read permission per URI,
  per share — it is the only way to hand a stored file to another app on
  Android 7+.
- **The permission list must stay empty.** Bazaar shows it on the listing.
  Any future feature that would need a permission is a decision, not a
  detail.

## 9. Storage layout on disk

```
/data/data/com.localsavedmessages.app/
├── files/                        ← permanent, app-private
│   ├── 2026/10/
│   │   └── 8f3c…-a1b2….pdf      ← one file per stored attachment
│   ├── avatars/
│   └── exports/                  ← generated .zip files (also offered to the user)
├── cache/
│   ├── inbox/<sessionId>/        ← temporary copies during a share; wiped on cancel
│   ├── thumbs/                   ← Coil's disk cache
│   └── archive-import/           ← staging while unzipping
├── databases/
│   └── localsavedmessages.db     ← Room
└── shared_prefs/                 ← DataStore
```

Everything under `files/` is deleted only by the user, by an explicit "clear
cache" action (thumbnails only), or when the app is uninstalled.
