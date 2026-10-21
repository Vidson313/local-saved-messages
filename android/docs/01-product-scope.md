# 01 — Product Scope

## 1. The decision that shapes everything

**The Android app in v1 is a purely local vault. It does not talk to the
Next.js server at all.**

This is a deliberate scope decision, not a limitation. The request was: a
native Android app that can receive files and text from Telegram's share sheet
and keep them available offline, with as little friction as possible for the
user.

What that decision buys:

| Benefit | Explanation |
|---------|-------------|
| **No network code** | No OkHttp, no SSE, no WorkManager, no sync state machine, no conflict resolution, no "offline" vs "online" states. The app has exactly one mode. |
| **No "connecting" spinner, ever** | Cold start reads SQLite. The first frame already has the data. |
| **No credentials, no server URL, no tokens** | Nothing to configure on first launch. The app is usable the second it is installed. |
| **No LAN dependency** | Works on a plane, in the car, at a café with no wifi. |
| **The data survives the server** | The web app's `data/messages.json` is a single file on one PC. Here, the archive is on the phone. |
| **Much smaller surface** | Roughly 40% of the code a syncing client would need. Fewer bugs. |

What it costs — stated honestly:

| Cost | Mitigation |
|------|-----------|
| The phone's archive and the web app's archive are **separate** | Not in scope in v1. The schema is designed so a sync layer can be added later without a data migration (see §4). |
| No cross-device access to the Android archive | Same answer. |
| Uninstalling the app loses the archive | **Mandatory** export/import in v1, plus an onboarding nudge. See [03-local-data.md](03-local-data.md) §5. |
| No push notifications | Nothing is time-critical in a personal archive. |

## 2. What v1 does

### 2.1 Ingestion (the core)

1. **Share target.** The app registers for `ACTION_SEND` (single item) and
   `ACTION_SEND_MULTIPLE` (several items), for both text and arbitrary
   streams. It appears in the system share sheet of Telegram, WhatsApp, Chrome,
   the Files app, and anywhere else.
2. **Destination picker.** On share, the app opens a screen showing the
   available folders. The user picks one.
3. **Optional note.** A text field lets the user add a caption/note. The
   message may be sent with no text at all (file only) or with text only
   (no file) — both are valid.
4. **Immediate local save.** The content is copied into app-private storage
   and written to SQLite. The user sees a confirmation and is returned to
   Telegram (or taken into the app, configurable).

Full detail, including the URI-permission pitfalls, in
[04-ingestion.md](04-ingestion.md).

### 2.2 Browsing and organising

| Feature | Detail |
|---------|--------|
| **Folders** | A flat list of named folders (the "chats" of the web app). One is created on first launch. |
| **Entry list** | Every saved item, newest first, grouped by day. Text entries and file entries render differently. |
| **File preview** | Images, video, audio, and PDF preview in-app; everything else opens with an external viewer. |
| **Search** | Full-text over note text and file names. |
| **Tags** | Arbitrary labels on entries, with a filter chip row. |
| **Pin** | Pin an entry to the top of its folder. |
| **Rename / delete** | On both folders and entries, with undo for entry deletion. |
| **Sort** | By date (newest/oldest) or by name. |
| **Move** | Move an entry to another folder. |

### 2.3 Data safety

| Feature | Detail |
|---------|--------|
| **Export** | The full archive (database + files) to a single `.zip`, written to a user-chosen location via SAF. |
| **Import** | Restore from that zip, merging into the existing archive. |
| **Storage readout** | Size used, per type, in Settings. |
| **No auto-delete** | Nothing is ever removed automatically. |

### 2.4 App-level niceties

| Feature | Detail |
|---------|--------|
| Material 3 theming | Light / dark / system, following the web app's palette. |
| **Persian + English** | Persian is the default locale with a mirrored RTL layout; English is the fallback. See [08-persian-localization.md](08-persian-localization.md). |
| Text scaling | The message body honours the system font scale. |
| Device lock | Optional gate using `BiometricPrompt` with `DEVICE_CREDENTIAL` fallback — never a hand-rolled PIN. |
| RTL | Layouts use `start`/`end` and mirror automatically. |
| Share-out | Any entry can be shared back out to other apps. |
| **Support** | A "Report a problem" action that builds a local log file and shares it through the app's own share sheet — no network, no third-party SDK. |

## 3. What v1 does **not** do

| Not in v1 | Why |
|-----------|-----|
| Sync with the web app / server | Out of scope by decision. The schema leaves room for it later. |
| Any network permission | The app declares **no** `INTERNET` permission, and `ACCESS_NETWORK_STATE` is stripped from the merged manifest. This is a guarantee, not an intention — it is verifiable with `aapt2 dump permissions`. |
| Importing Telegram's own local database | The format is private, undocumented, encrypted, and changes with every update; the Android copy requires root. The share sheet is the supported path. |
| Reading Telegram chats programmatically | Requires the Bot API (which cannot see Saved Messages) or a user account via MTProto/TDLib — both add credentials, terms-of-service surface, and complexity that a personal app does not need. |
| Reactions, location sharing | Not present in the source app either. |
| Cloud backup | `allowBackup="false"` — the user may not want their archive in the cloud. Export is manual and local. |
| In-app update checker | The Bazaar store delivers updates, and the checker would need the `INTERNET` permission the app must not have. |
| Crash-reporting SDK | It would need `INTERNET` and would upload user data. The local log file + share sheet covers the same need. |
| Multiple devices sharing one archive | Same as the sync item above. |
| Folders nested inside folders | Tags cover the cross-cutting case without a tree UI. |

## 3.1 What v1 **does** add beyond the original scope

| Feature | Detail |
|---------|--------|
| **Voice recording** | Record a voice note inside the app, saved as an `m4a` attachment. Requires `RECORD_AUDIO`, requested at the moment of recording. |
| **Secure vault** | A folder whose contents are gated behind the device lock (`BiometricPrompt` with a `DEVICE_CREDENTIAL` fallback). **A privacy gate, not encryption** — see [10-stitch-review.md](10-stitch-review.md) §1 for why the copy must be honest about this. |
| **File-type filter** | Filter a folder by image, video, audio, voice, document or note. The category is stored on the row, so the filter is an indexed comparison rather than a MIME scan. |

## 4. How the schema stays sync-ready

Even though v1 has no sync, the storage layer is not written as if the app
were a throwaway prototype. Two deliberate choices:

1. **IDs are client-generated UUIDs, not server-assigned.** The web app
   assigns `randomUUID()` on the server. Here the client generates the id at
   creation time and it never changes. If a sync layer is added later, the
   client id can be carried to the server as a client-supplied id, or mapped
   through a join table — no re-keying of existing rows, no migration of
   user data.
2. **Timestamps are stored as epoch millis with an explicit `origin` flag**
   (`DEVICE` or `SERVER`). Today every row is `DEVICE`. A later sync sets
   `SERVER` and can detect clock skew.

Both are cheap now and expensive to retrofit later.

## 5. Relationship to the web app

```
┌──────────────────────┐        ┌──────────────────────────┐
│  Web app (Windows)   │        │  Android app             │
│  Next.js + server    │        │  Kotlin + Compose        │
│  ───────────────     │        │  ────────────────        │
│  data/messages.json  │        │  Room SQLite + files/    │
│  public/uploads/     │        │  (app-private storage)   │
│                      │        │                          │
│  Needs the server    │        │  Needs nothing           │
│  to render at all    │        │  to render at all        │
└──────────────────────┘        └──────────────────────────┘
             │                                │
             └─────────── no link in v1 ──────┘
```

The two apps share a **concept** (folders of messages and files) and a
**visual identity** (the same palette, the same icon). They do not share
data, code, or a network protocol in v1.

The web app remains the tool for *capturing* content from a desktop browser
(upload, drag & drop, paste). The Android app is the tool for *keeping*
content on the phone and reading it anywhere.

## 6. User journey — the 30-second story

1. User installs the app from the **Bazaar** app store (or sideloads the APK
   directly; the app's "About" screen explains the "unknown apps" toggle).
2. First launch: a name is suggested for the first folder ("Saved Messages").
   No server, no account, no network prompt.
3. In Telegram: open a chat, long-press a **downloaded** file → Share →
   **Local Saved Messages**.
4. The app opens on the folder picker with the file preview at the top.
   The user picks "Saved Messages", optionally types "invoice for March",
   and taps send.
5. The app copies the file into its storage, shows a snackbar with "View", and
   returns to Telegram.
6. Later, on the subway, the user opens the app and finds the file with its
   note, searchable, next to everything else they saved.

That is the whole product. Everything else in these documents is in service of
making those six steps work flawlessly.
