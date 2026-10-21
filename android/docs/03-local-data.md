# 03 — Local Data

Everything the app knows lives in two places: a SQLite database and a tree of
files in app-private storage. This document defines both, and the export/import
that lets the user take their archive with them.

---

## 1. Database

Room, file `localsavedmessages.db`. All write operations that touch more than
one table run inside a single transaction.

### 1.1 `folders`

The equivalent of the web app's "chats" — a destination for entries.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Client-generated UUID. Never changes. |
| `name` | TEXT NOT NULL | Display name, unique |
| `icon` | TEXT NOT NULL | Emoji or a single glyph, e.g. `"📁"` |
| `color_index` | INTEGER | Index into a fixed palette; avoids storing raw colours |
| `is_vault` | INTEGER | 0/1 — the single folder gated behind the device lock |
| `is_protected` | INTEGER | 0/1 — the default folder cannot be deleted |
| `created_at` | INTEGER | Epoch millis |
| `updated_at` | INTEGER | Epoch millis |

Indexes: unique index on `name`.

The web app's `default` chat is not special here — it is just a folder that
happens to be created on first launch and cannot be deleted (the
`is_protected` flag rather than a magic id).

### 1.2 `entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Client-generated UUID |
| `folder_id` | TEXT NOT NULL | FK → `folders.id` (cascade delete) |
| `category` | TEXT NOT NULL | `IMAGE` \| `VIDEO` \| `AUDIO` \| `VOICE` \| `DOCUMENT` \| `TEXT` |
| `note` | TEXT | The user's note / caption. Empty string when there is none. |
| `body` | TEXT NULL | Plain text body when the shared content was text |
| `file_path` | TEXT NULL | Relative path under `files/`, e.g. `2026/10/8f3c….pdf` |
| `file_name` | TEXT NULL | Original display name, as given by the source app |
| `file_size` | INTEGER NULL | Bytes |
| `mime_type` | TEXT NULL | From the source Intent |
| `duration_ms` | INTEGER NULL | Audio/video/voice duration |
| `width` / `height` | INTEGER NULL | Image/video dimensions |
| `thumb_path` | TEXT NULL | Relative path of the generated thumbnail |
| `pinned` | INTEGER | 0/1 |
| `hidden` | INTEGER | 0/1 — 1 means "soft-deleted, pending confirm" (§1.5) |
| `hidden_at` | INTEGER NULL | Epoch millis, for the undo window |
| `tags` | TEXT | JSON array of tag strings, encoded with `kotlinx.serialization` |
| `created_at` | INTEGER | Epoch millis |
| `updated_at` | INTEGER | Epoch millis |

**`category` rather than `kind`.** The category is derived from the MIME type
at write time and stored, so the type filter is an indexed comparison
(`WHERE category = 'IMAGE'`) rather than a scan with a `LIKE 'image/%'` prefix
test on every row. A note and its attachment are one row, so there is no
separate "note with a file" category — the row has both a `note` and a
`file_path`, and the category describes the file.

`VOICE` is distinguished from `AUDIO` by the file's origin: a voice note
recorded inside the app, rather than an audio file that arrived over the
share sheet.

Indexes: `folder_id`, `(folder_id, created_at)`, `pinned`, `hidden`.

`tags` is stored as a JSON array on the row rather than in a cross-reference
table. Rationale: the tag set per entry is tiny (0–5 in practice), entries are
always read as a whole, and tag *filtering* is done with a `LIKE` match
against the JSON text or in memory after the query. A normalised
`tags` + `entry_tags` table would buy faster tag queries at the cost of an
extra join on every read. At personal-archive scale (thousands of rows) the
denormalised form is measurably simpler and fast enough. If the app ever
grows to tens of thousands of entries, migrating to a join table is a
contained change (§7).

### 1.3 Search

**Search is a `LIKE` scan, not an FTS index.** This was the original plan, and
it changed during implementation for a reason that only shows up in Persian.

SQLite's default tokenizer splits words on non-alphanumeric characters. The
ZWNJ (U+200C) that joins the parts of a Persian compound word — «برنامه‌نویسی»,
«می‌رود», «پوشه‌ها» — is not alphanumeric, so the tokenizer cuts the word in
half. A search for «برنامه» would never find «برنامه‌نویسی». For an app whose
primary language is Persian, that is a defect, not a limitation.

A `LIKE` scan has no tokenizer, so it matches the way a person expects. The
pattern is built by `SearchQuery.pattern()`: the user's text is escaped so a
literal `%` or `_` is matched as a character rather than as a wildcard, and
then wrapped in `%…%`.

The cost is a full scan of the visible rows. At personal-archive scale — a
few thousand entries — that is a sub-millisecond operation, and it runs on a
background dispatcher. If the archive ever grows to tens of thousands of
rows, the migration path is a custom Persian-aware tokenizer registered
through `SQLiteConnection.setCustomTokenizer`. That is a contained change:
the DAO query is the only thing that moves.

### 1.3.1 The original FTS approach (rejected)

For the record, this is what the plan called for before the tokenizer problem
was found. Room's FTS4 support gives a `entries_fts` virtual table:

```sql
CREATE VIRTUAL TABLE entries_fts USING fts4(
    note, body, file_name, content=""
);
```

`content=""` makes it a *contentless* FTS table: the FTS index stores only
the tokenised terms, not a second copy of the text. The app keeps the FTS
index in sync through triggers on `entries`:

```sql
CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(docid, note, body, file_name)
  VALUES (new.rowid, new.note, new.body, new.file_name);
END;
-- …plus matching AFTER UPDATE and AFTER DELETE triggers
```

Search query:

```sql
SELECT e.* FROM entries e
JOIN entries_fts f ON f.docid = e.rowid
WHERE entries_fts MATCH ? AND e.hidden = 0
ORDER BY e.created_at DESC
```

**Rejected** — the `MATCH` string was safe from injection (every term quoted,
internal quotes doubled), but the tokenizer was not fit for Persian. The
triggers were never shipped; the schema has no `entries_fts` table.

### 1.4 `settings`

A small key-value table, mirrored into DataStore for the values the UI needs
before the DB opens:

| Key | Value |
|-----|-------|
| `active_folder_id` | The folder last opened |
| `sort_order` | `DATE_DESC` \| `DATE_ASC` \| `NAME` |
| `theme_mode` | `SYSTEM` \| `LIGHT` \| `DARK` |
| `require_device_lock` | Boolean |
| `onboarded` | Boolean |
| `last_export_at` | Epoch millis |
| `db_schema_version` | Integer |

### 1.5 Soft delete (the undo window)

Rather than a separate table, a deleted entry is flagged:

| Field | Value while soft-deleted |
|-------|--------------------------|
| `hidden` | `1` |
| `hidden_at` | epoch millis of the delete |

A `WorkManager` job scheduled for `hidden_at + 5 s` performs the hard delete.
A `hidden` row is excluded from every normal query (`hidden = 0`) and from
search. "Undo" clears the flag and cancels the job. A periodic sweep deletes
any `hidden = 1` row whose `hidden_at` is older than the window — that covers
the case where the app was killed before the job ran.

---

## 2. File storage

### 2.1 Layout

```
files/
├── 2026/10/8f3c1a2b-….pdf
├── 2026/10/91d4e5f6-….jpg
├── avatars/3a2b…-….png
└── exports/local-saved-messages-2026-10-21.zip
```

Files are sharded by `yyyy/mm` so that no directory holds tens of thousands of
entries, which keeps directory scans fast on ext4/f2fs and avoids issues on
Windows when the archive is exported and re-imported on a PC.

The stored file name is `<uuid>.<ext>` — **not** the original name. The
original name is kept in `entries.file_name` and is only ever used for
display. This avoids every filename problem at once: no path traversal, no
invalid characters, no collisions, no case-sensitivity issues, and no length
limits.

The extension is derived from the MIME type via a small lookup table, with a
sanitised fallback to the source's extension when the MIME type is unknown or
generic (`application/octet-stream`).

### 2.2 Why app-private storage

| Option | Verdict |
|--------|---------|
| **App-private `files/`** | ✅ **Chosen.** No permission, invisible to the gallery, deleted only on uninstall, survives app updates, and the user can export deliberately. |
| `MediaStore` (shared media) | ❌ Files would appear in the gallery and other apps could delete them. Wrong for a private archive. It is used only as an *export target* when the user explicitly shares a file out. |
| `MANAGE_EXTERNAL_STORAGE` | ❌ Never request it. It is a heavy, review-worthy permission for no benefit here, and it is a privacy smell. |
| `SAF` (user-picked directory) | ❌ Not as the primary store — the user would have to pick a folder and the app could lose access if it is unmounted. Used for *export* only. |

### 2.3 Importing a shared file

```kotlin
suspend fun import(uri: Uri, displayName: String?, mimeType: String?): StoredFile {
    val extension = resolveExtension(mimeType, displayName)
    val target = FileStore.newFile(extension)          // files/2026/10/<uuid>.ext
    // Stream, never buffer. A 2 GB video must not become a 2 GB ByteArray.
    context.contentResolver.openInputStream(uri)!!.use { input ->
        target.outputStream().use { output ->
            input.copyTo(output, DEFAULT_BUFFER_SIZE)  // 8 KB chunks
        }
    }
    return StoredFile(relativePath = target.relativePath(), byteSize = target.length())
}
```

Checks performed **before** the copy:

| Check | Rule | Why |
|-------|------|-----|
| Non-empty | `size > 0` | A zero-byte file is useless |
| Size ceiling | ≤ **2 GB** per file | Practical ceiling for a phone; matches what Telegram itself allows |
| Total size ceiling | ≤ **8 GB** for the whole archive | The app shows usage; the user manages it. `StatFs` is consulted to warn when the device is low on space. |

The size ceiling is checked via `openFileDescriptor` + `getStatSize` when
available, and by counting bytes during the copy otherwise (so a lying
provider cannot exceed the limit).

### 2.4 Thumbnails

Images, video, and audio get a thumbnail so the list renders without decoding
full media:

| Type | Thumbnail | Size |
|------|-----------|------|
| Image | `ThumbnailUtils` / `BitmapFactory` downscale | 512 px longest edge, JPEG q80 |
| Video | `MediaMetadataRetriever.getFrameAtTime()` | 512 px, JPEG q80 |
| Audio | none — a music-note icon | — |
| PDF | none — a PDF icon | — |
| Other | none — a file-type icon | — |

Thumbnails live in `cache/thumbs/` and are regenerated on demand. They are
**not** part of the export archive.

### 2.5 Deduplicating identical files

If the user shares the same file twice, the app stores two copies. A
content-hash check would avoid that, but it means reading the whole file to
hash it before deciding to keep it — doubling the I/O for the common case of
a genuinely new file. **Decision: no deduplication.** Disk is cheap; the
extra read is not. The user can delete duplicates themselves, and the search
screen shows both.

---

## 3. Data lifecycle

| Event | Effect |
|-------|--------|
| Entry deleted (confirmed) | Row deleted, file removed from disk if no other row references it |
| Entry deleted (undone) | Flags cleared, nothing on disk changed |
| Folder deleted | All its entries are deleted (files removed), the folder row is deleted. A protected folder cannot be deleted. |
| Entry moved to another folder | `folder_id` updated, `updated_at` touched |
| App killed mid-import | `cache/inbox/` and `cache/archive-import/` are wiped on next launch; permanent files are only ever written in the same transaction that inserts the row |
| App uninstalled | Everything is gone — **hence export** |

**The "files are only ever promoted in a transaction" rule**

`FileImporter` writes into `cache/inbox/<sessionId>/` first. On confirmation,
the file is *moved* into `files/` and the row is inserted. The move happens
inside the same database transaction that inserts the row. If the transaction
rolls back, the file is moved back (or simply deleted, since the session
directory is swept).

The result: **there is never a permanent file with no database row.** The
reverse (a row with no file) is possible only if the file is deleted from
outside the app, which cannot happen with app-private storage.

---

## 4. Reference counting of stored files

Two entries can point at the same stored file only if a future feature
duplicates an entry (e.g. "copy to another folder"). Today, one file = one
entry. The delete path still checks:

```kotlin
suspend fun deleteFileIfUnreferenced(relativePath: String) {
    val stillUsed = entryDao.countByFilePath(relativePath) > 0
    if (!stillUsed) fileStore.delete(relativePath)
}
```

This keeps the door open for duplication without a migration later.

---

## 5. Export and import (mandatory in v1)

Because the app is published on the Bazaar store, a user can install it,
update it, and — if they choose — have their device's cloud backup silently
copy the database unless `allowBackup="false"` is set (it is). Beyond that, a
user who uninstalls — to free space, to reinstall after a signing-key change,
or because the phone was lost — the archive is gone. **Export and import are
therefore a v1 requirement, not a "later" feature.**

### 5.1 Export

The user picks a destination via the Storage Access Framework (`ACTION_CREATE_DOCUMENT`).
The app writes a single `.zip`:

```
local-saved-messages-2026-10-21.zip
├── manifest.json          ← format version, export timestamp, app version
├── database/
│   └── entries.db         ← a copy of the Room database
└── files/
    └── 2026/10/8f3c1a2b-….pdf
```

`manifest.json`:

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-10-21T09:12:33.000Z",
  "appVersion": "1.0.0",
  "entryCount": 342,
  "folderCount": 5,
  "totalBytes": 1843200000
}
```

Writing rules:

- The zip is streamed, never assembled in memory.
- The database copy is produced by `VACUUM INTO` so it is a compact, valid
  SQLite file — not a copy of the WAL.
- The export is written to a temp file first, then renamed, so a cancelled
  export never leaves a half-written zip.
- Progress is reported per file.

### 5.2 Import

The user picks a `.zip` via `ACTION_OPEN_DOCUMENT`. The app:

1. Reads and validates `manifest.json`; rejects an unknown `formatVersion` with
   a clear message.
2. Stages the zip in `cache/archive-import/`.
3. Inserts the database into the current one with **prefixed ids** — every
   imported id is rewritten as `<importId>:<originalId>` so that importing the
   same archive twice does not collide.
4. Copies the files into `files/` under their new names, preserving the
   original relative path.

**Import mode is a user choice**, shown as a dialog:

| Mode | Behaviour |
|------|-----------|
| **Merge** (default) | Imported entries are added; existing ones are untouched. Duplicate content is allowed. |
| **Replace** | The current archive is wiped and replaced by the imported one. Destructive — requires explicit confirmation. |

### 5.3 Backup nudge

On first launch, after the first successful save, the app shows a one-time
snackbar: *"Keep a backup — export your archive."* It is dismissible and
never shown again. The Settings screen has a prominent "Export archive"
action with the last-export date.

---

## 6. DataStore

A separate `Preferences` DataStore for the small settings the UI needs before
the database is open:

| Key | Type | Default |
|-----|------|---------|
| `theme_mode` | String | `SYSTEM` |
| `sort_order` | String | `DATE_DESC` |
| `require_device_lock` | Boolean | `false` |
| `onboarded` | Boolean | `false` |
| `last_export_at` | Long | `0` |

`active_folder_id` lives in the database instead, because it is relational
data that must be consistent with the folder rows.

DataStore is read **asynchronously** and the UI renders in a defined "loading"
state until the first value arrives — there is no blocking read on the main
thread (the web app's `localStorage` pattern has no Android equivalent, and
the app avoids `SharedPreferences.getString` on the main thread as well).

---

## 7. Migration policy

Room's `Migration` objects, never `fallbackToDestructiveMigration`. The
archive is the user's data; losing it to a schema change is unacceptable.

| From → To | Change | Migration |
|------------|--------|-----------|
| 1 → 2 (future) | `tags` JSON → `entry_tags` join table | Copy rows in SQL |
| Any | Adding a nullable column | `ALTER TABLE … ADD COLUMN` |
| Any | Adding a table | `CREATE TABLE` |

`db_schema_version` in the `settings` table tracks the exported format
version independently of the Room schema version, so the export format can
evolve without breaking imports of older archives.

---

## 8. Storage budget and warnings

| Threshold | Behaviour |
|-----------|-----------|
| Device free space < 1 GB | A warning is shown on the share screen before copying |
| Device free space < 250 MB | Copying is refused with a clear message |
| Archive > 8 GB | New shares are refused; the user must export and delete to free space |
| Single file > 2 GB | The item is rejected with a clear message |

The archive total is tracked in `settings.archive_bytes` and updated
transactionally whenever an entry is added or removed.
