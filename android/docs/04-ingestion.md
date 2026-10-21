# 04 — Ingestion: The Share Sheet Path

This is the core of v1. Everything else in the app exists to serve what
happens here.

---

## 1. The user story

> In Telegram, I tap a **downloaded** file → **Share** → **Local Saved
> Messages**. The app opens, I pick a folder, I optionally type a note, I tap
> send. The file is saved. Later, offline, I can find it.

Two things about this story decide the implementation:

1. **The user must never be asked to configure anything.** No server, no
   account, no folder to create before the first share. The app must be
   usable in the two seconds between tapping "Share" and the picker appearing.
2. **The share intent is a one-shot, time-limited grant.** The bytes must be
   captured immediately or they are gone.

---

## 2. The share target

### 2.1 Manifest declaration

```xml
<activity
    android:name=".ingestion.ShareTargetActivity"
    android:exported="true"
    android:label="@string/app_name"
    android:icon="@mipmap/ic_launcher"
    android:theme="@style/Theme.LocalSavedMessages.Share"
    android:launchMode="singleTask"
    android:excludeFromRecents="true"
    android:taskAffinity="">
```

- A **dedicated activity**, not the main one. It must be able to finish
  immediately after the user confirms, returning the user to Telegram.
- `excludeFromRecents="true"` — a share target should not leave a ghost entry
  in the recents list.
- `taskAffinity=""` — a separate task, so the share target never sits in the
  same task as the main UI (which would make "back" behave oddly).
- `launchMode="singleTask"` — sharing ten files in a row must not stack ten
  activities.

### 2.2 Intent filters

| Filter | MIME types | Triggered by |
|--------|-----------|--------------|
| `ACTION_SEND` | `text/*` | Sharing text, a link, a note |
| `ACTION_SEND` | `image/*`, `video/*`, `audio/*`, `application/*` | Sharing one file |
| `ACTION_SEND_MULTIPLE` | `image/*`, `video/*`, `audio/*`, `application/*` | Sharing several files |

`text/*` is registered as a wildcard rather than `text/plain` because some
apps share `text/html` or `text/markdown` bodies.

Android does **not** require `<queries>` for `ACTION_SEND` — the intent is
explicit, and the package-visibility restrictions introduced in Android 11 do
not apply to it. But `PackageManager.queryIntentActivities` is used in the
app's own "can I share to this app?" check (a "Share to…" action in the entry
detail screen), which does need a `<queries>` element with a matching
`intent-filter` block. It is declared.

### 2.3 What Telegram actually sends

| Shared item | Intent | Notes |
|-------------|--------|-------|
| A **downloaded** file | `ACTION_SEND` with `EXTRA_STREAM` | A `content://` URI backed by Telegram's media cache. The grant lasts for the receiving activity's lifetime. |
| A **cloud** file (not downloaded) | `ACTION_SEND` with `EXTRA_TEXT` | Telegram shares a `t.me/...` link instead of the bytes. There is no file to save. |
| Selected text | `ACTION_SEND` with `EXTRA_TEXT` | Plain text. |
| A photo (viewed, not downloaded) | `ACTION_SEND` with `EXTRA_STREAM` + `EXTRA_TEXT` | Telegram often adds a caption in `EXTRA_TEXT`. |
| Several files | `ACTION_SEND_MULTIPLE` with `EXTRA_STREAM` (a `ClipData` list) | Each URI is granted individually. |

**The cloud-file case is the most important edge case.** If the user shares a
file they have not downloaded, Telegram gives a link. The app cannot
download it (that would need the user's Telegram credentials, and would also
break the offline promise). The correct behaviour is to tell the user:

> "This file is still in Telegram's cloud. Download it first, then share it."

…and offer to open Telegram so they can do that. The link itself is saved as
a text entry so the information is not lost.

---

## 3. Intent parsing

```kotlin
sealed interface InboxItem {
    val displayName: String

    data class TextItem(
        override val displayName: String,
        val text: String,
    ) : InboxItem

    data class FileItem(
        override val displayName: String,
        val uri: Uri,
        val mimeType: String,
        val sizeBytes: Long?,      // null when the provider does not report it
    ) : InboxItem
}
```

`IntentParser.parse(intent): ParseResult` handles every shape Android allows:

| Intent shape | Handling |
|--------------|----------|
| `EXTRA_STREAM` is a single `Uri` | One `FileItem` |
| `EXTRA_STREAM` is a `ClipData` | One `FileItem` per item |
| `ACTION_SEND_MULTIPLE` with `EXTRA_STREAM` holding a `ClipData` | One `FileItem` per item |
| `EXTRA_STREAM` holding an array of `Uri` (some legacy apps) | One `FileItem` per element |
| `EXTRA_TEXT` present | One `TextItem` (or appended as the note if a file is also present) |
| Both `EXTRA_STREAM` and `EXTRA_TEXT` | The file plus a text item; the text becomes the **prefilled note** |
| Neither | A parse failure: "Nothing was shared" |

**Deduplication within one share:** the same URI can appear twice in a
`ClipData`. The parser deduplicates by URI string, keeping the first
occurrence.

**The `EXTRA_TEXT` + file combination** deserves a specific decision. When
Telegram shares a photo with its caption, `EXTRA_TEXT` holds the caption. If
the app created a separate text entry, the user would find their caption
split off from their photo. So: **when a file is present, `EXTRA_TEXT` becomes
the pre-filled note field**, not a separate entry. When there is no file,
`EXTRA_TEXT` becomes a text entry, and the note field is left empty.

---

## 4. The picker screen

### 4.1 Layout

```
┌─────────────────────────────┐
│  ✕  Save to Local Msgs       │   ← title bar with a close button
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │  📄  invoice-march.pdf │  │   ← preview of what is being saved
│  │      1.2 MB · PDF     │  │      (thumbnail for images/video)
│  └───────────────────────┘  │
│                             │
│  Note (optional)             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  Save to                    │
│  ┌───────────────────────┐  │
│  │ 💾  Saved Messages   › │  │   ← the folders, tappable
│  ├───────────────────────┤  │
│  │ 📁  Work            › │  │
│  ├───────────────────────┤  │
│  │ 📁  Receipts         › │  │
│  └───────────────────────┘  │
│  ＋ New folder               │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │        Save           │  │   ← primary button
│  └───────────────────────┘  │
└─────────────────────────────┘
```

For a multi-item share, the preview becomes a horizontal row of thumbnails
with a "+N" badge, and the note applies to all of them (one note for the
whole share, not per file).

### 4.2 Behaviour details

| Aspect | Decision |
|--------|----------|
| **New folder** | A "+ New folder" row at the bottom opens a small inline field. The name is created and immediately selected. |
| **Default selection** | No folder is pre-selected. Tapping "Save" with no selection shows an inline error. Rationale: silently dropping content into the wrong folder is worse than one extra tap. |
| **The Save button** | Disabled until a folder is chosen, with the reason visible as helper text. |
| **Back / ✕** | Cancels. Nothing is saved, and the temporary copies are discarded. |
| **While copying** | The screen shows a determinate progress bar over the preview area, with "Copying… 42%". The Save button is disabled. |
| **On success** | A snackbar: *"Saved to Work"* with a **View** action that opens the entry. Then the activity finishes and the user is back in Telegram. |
| **On partial failure** | The successful items are saved; a dialog lists the failures with their reasons, and offers "Save what worked" (already done) or "Return". |
| **Rotation** | The screen survives rotation: the parsed items, the selected folder, and the note are held in a `ViewModel` that survives configuration changes. The file copy continues in a `ViewModel`-scoped coroutine. |

### 4.3 The note field

- Single line by default, expands to multi-line on focus.
- The keyboard action is "Done", not "Send" — the user is not sending, they
  are labelling.
- If the share included `EXTRA_TEXT` and a file, the field is **prefilled**
  with it and the text is selected, so the user can edit or clear it easily.
- Maximum 5 000 characters. The counter appears only past 80% of the limit.

---

## 5. The copy step

### 5.1 Timing

The copy starts **as soon as the activity is created**, in parallel with the
user choosing a folder. By the time the user has picked a folder and typed a
note, the file is usually already there.

This is safe because the copy target is `cache/inbox/<sessionId>/`, and the
promotion into `files/` only happens after the user confirms (§5.4).

The only exception: if the file is very large, the copy might still be running
when the user hits Save. In that case the Save action waits for the copy to
finish rather than failing. The progress bar makes this visible.

### 5.2 Implementation

```kotlin
class FileImporter(
    private val context: Context,
    private val fileStore: FileStore,
    private val dispatcher: CoroutineDispatcher,
) {
    suspend fun import(
        uri: Uri,
        mimeType: String?,
        displayName: String?,
        sessionId: String,
        onProgress: (Long, Long) -> Unit,
    ): StoredFile = withContext(dispatcher) {
        val target = fileStore.stagedFile(sessionId, resolveExtension(mimeType, displayName))
        context.contentResolver.openInputStream(uri)?.use { input ->
            target.outputStream().use { output ->
                val buffer = ByteArray(64 * 1024)
                var total = 0L
                while (true) {
                    val read = input.read(buffer)
                    if (read == -1) break
                    output.write(buffer, 0, read)
                    total += read
                    if (total > MAX_FILE_BYTES) throw FileTooLargeException()
                    onProgress(total, expectedSize)
                }
            }
        } ?: throw SourceUnavailableException()
        StoredFile(target, target.length())
    }
}
```

Key points:

- **Streaming with a 64 KB buffer.** Never `readBytes()`.
- **The size ceiling is enforced during the copy**, not only before it, because
  a content provider can report a size that does not match the stream. The
  copy aborts and the partial file is deleted.
- **The expected total** comes from `openFileDescriptor().statSize` when
  available; otherwise the progress bar is indeterminate.
- The `input.read()` loop also naturally handles providers that return
  fewer bytes than requested.

### 5.3 Permissions

**No runtime permission is needed for the share path.** The URI grant comes
with the intent.

What *is* needed, and why it is not a problem:

| Grant | Lifetime | How the app handles it |
|-------|----------|------------------------|
| `FLAG_GRANT_READ_URI_PERMISSION` on the incoming URI | Until the receiving activity is destroyed | The app copies within the activity's lifetime. If the copy is still running when the activity is destroyed, the `ViewModel` keeps it alive — but the grant is tied to the *activity*, so the copy is cancelled and restarted if it fails with `SecurityException`. |

`takePersistableUriPermission` is **not** used: it only works for URIs the
user picked through the system file picker (`ACTION_OPEN_DOCUMENT`), not for
share-intent grants. This is exactly why the copy must happen immediately.

### 5.4 Promotion

```kotlin
// On Save:
db.withTransaction {
    entryDao.insertAll(entries)          // rows first
    tagDao.applyTags(entries)
    fileStore.promote(sessionId)         // move cache/inbox/… → files/…
}
// If the transaction rolls back, the staged files are deleted.
```

`FileStore.promote` moves each staged file to its permanent path
(`files/<yyyy>/<mm>/<uuid>.<ext>`) and returns the new relative path, which
is what gets written into the row.

---

## 6. Sharing *out* of the app

The reverse direction — getting an entry back out — is a first-class feature
too, because a vault you cannot extract from is a dead end.

| Entry type | Outbound intent |
|------------|-----------------|
| File entry | `ACTION_SEND` with a `FileProvider` URI for the stored file, `FLAG_GRANT_READ_URI_PERMISSION` |
| Text entry | `ACTION_SEND` with `text/plain` |

`FileProvider` is required: Android 7+ forbids `file://` URIs across app
boundaries. The provider is declared in the manifest with a narrow path
(`files/`) and a `paths.xml` that exposes only the attachment subdirectory.

The user picks the target in the system share sheet. The app does not
enumerate apps or require a storage permission.

---

## 7. Alternative ingestion paths (evaluated, deferred)

| Path | Verdict |
|------|---------|
| **Share sheet** | ✅ **Implemented in v1.** No credentials, no ToS surface, supported by the OS. |
| **Drag & drop from a PC (ADB)** | ❌ Not possible without the user running ADB. |
| **Files app "Copy to"** | ❌ Android has no such concept. |
| **Read Telegram's local DB** | ❌ Private format, encrypted, needs root, breaks on every update. |
| **Bot API bridge** | ❌ A bot cannot read your Saved Messages — you would have to forward everything to it manually, and cloud downloads cap at 20 MB. |
| **MTProto / TDLib with a user session** | ❌ Requires `api_id`/`api_hash`, 2FA, session management, and Flood-Wait handling. This is a *sync* feature, not an ingestion feature. |
| **Telegram Desktop export (JSON)** | ⚠️ Possible, but it is a *backfill* tool for a desktop archive, not a phone workflow. Noted here for completeness; not in v1. |

**The rule that governs all of these:** the share sheet is the *only* path
that requires no credentials, no permissions the user must grant beyond the
share gesture itself, and no third-party service. It is also the path
Android is designed to support. Everything else is a workaround.

---

## 8. Acceptance criteria for the ingestion feature

| # | Criterion | How it is verified |
|---|-----------|-------------------|
| I1 | Sharing a downloaded file from Telegram shows "Local Saved Messages" in the share sheet | Manual test on a real device with Telegram ≥ 2.x |
| I2 | The app opens directly on the picker, with no configuration step | Manual test |
| I3 | The picked file is byte-identical to the source (SHA-256 comparison) | Automated: share a known file, compare hashes |
| I4 | The saved file is still readable **after the source app is closed and the Telegram cache is cleared** | Manual test — clear Telegram's cache, then open the entry |
| I5 | A note can be added, and is stored with the entry | Manual + unit test |
| I6 | A share can be cancelled with nothing written to the permanent store | Automated: assert `files/` is empty and `cache/inbox/` is swept |
| I7 | Sharing 5 files at once saves 5 entries in one share | Manual |
| I8 | A file larger than 2 GB is rejected with a clear message and no partial file is left behind | Automated |
| I9 | Rotating the device mid-share does not lose the selection or the note | Manual |
| I10 | Sharing from a source with no permission grant (a revoked URI) fails gracefully, not with a crash | Automated |
