# 05 — UI / UX Specification

The app is a **phone-first archive**, not a port of the web app's three-column
desktop layout. The design language borrows the web app's palette and icon so
the two feel like one product, but the information architecture is native.

---

## 1. Design language

### 1.1 Colour

The web app's palette lives in `app/globals.css` as CSS custom properties.
The Android client uses the same values.

| Token | Light | Dark | Web source |
|-------|-------|------|-----------|
| `primary` | `#3390EC` | `#58A6FF` | `--tg-blue` |
| `accent` | `#3FA35C` | `#56D364` | `--tg-green` |
| `surface` | `#FFFFFF` | `#1E1E30` | `--tg-white` / `--tg-modal-bg` |
| `background` | `#F4EDE9` | `#1A1A2E` | `--tg-page` |
| `chatBackground` | `#EFE8DD` | `#0D1117` | `--tg-chat-bg` |
| `bubble` | `#FFFFFF` | `#21262D` | `--tg-bubble` |
| `bubbleSelf` | `#E3F2FF` | `#1C2D4A` | `--tg-bubble-self` |
| `textPrimary` | `#26292D` | `#E4E6EB` | `--tg-text` |
| `textSecondary` | `#7C8088` | `#8B949E` | `--tg-muted` |
| `leftRail` | `#F2D7D9` | `#0F3460` | `--tg-left-rail` |
| `chatList` | `#F7E6E6` | `#16213E` | `--tg-left` |
| `activeChat` | `#3F8AE0` | `#3390EC` | `--tg-left-active` |
| `fileBubble` | `#DCF0FF` | `#1C2D4A` | `--tg-file-bubble` |

The web app's glassmorphism (translucent panels over a gradient) is **not**
ported. Material 3 surfaces are opaque by design, and translucency over a busy
background hurts legibility and battery life on OLED. The gradient body
background becomes a flat `background` surface.

**Folder colours.** Each folder carries a `color_index` into a fixed palette
of eight accessible hues, applied to its icon badge. Colours are never the
only signal — the folder's emoji/glyph and name are always shown.

**Theme modes:** `System` / `Light` / `Dark`, stored in DataStore, applied
before the first frame through a splash-screen background that matches the
resolved theme (no flash of the wrong theme).

**Locale:** Persian is the default locale; English is the fallback. The
layout direction follows the system locale, and the Persian layout mirrors.
See [08-persian-localization.md](08-persian-localization.md) for the full
rules — the terminology glossary, the RTL specifics, the Jalali calendar,
and the Persian typography rules.

### 1.2 Typography

| Role | Size | Weight |
|------|------|--------|
| Headline | 24 sp | SemiBold |
| Title (folder name) | 20 sp | SemiBold |
| Title (list item) | 16 sp | Medium |
| Body (entry note) | 16 sp | Regular |
| Label | 14 sp | Medium |
| Caption (timestamp, size) | 12 sp | Regular |

Entry notes honour the **system font scale**. The app does not implement its
own font-size setting — Android already provides one, and overriding it
app-wide would be hostile. (The web app's Small/Medium/Large setting has no
Android equivalent and is deliberately not ported.)

### 1.3 Shape & spacing

- Corner radius: 16 dp for cards, 28 dp for buttons, 12 dp for chips.
- Spacing scale: 4 / 8 / 12 / 16 / 24 dp.
- Minimum touch target: 48 dp everywhere.

### 1.4 Iconography

The app icon is the web app's `public/icon.svg` — a blue gradient tile with a
white bookmark. It is ported as an Android adaptive icon:

- `ic_launcher_background` — the gradient, rendered as a vector drawable.
- `ic_launcher_foreground` — the bookmark, with the safe zone respected.
- Monochrome variant for themed icons (Android 13+).

In-app icons use **Material Symbols**, matching the `lucide-react` set the web
app uses. The icon names map one-to-one: `attach` → `AttachFile`, `send` →
`Send`, `pin` → `PushPin`, `save` → `Bookmark`, `folder` → `Folder`,
`search` → `Search`, `delete` → `Delete`, `share` → `Share`,
`more-vert` → `MoreVert`, `edit` → `Edit`, `tag` → `Label`,
`lock` → `Lock`, `settings` → `Settings`.

---

## 2. Navigation

### 2.1 Top-level

A **bottom navigation bar** with four destinations, visible on top-level
screens only:

| Destination | Icon | Screen |
|-------------|------|--------|
| Folders | Folder | `FoldersScreen` — the list of folders |
| Search | Magnifier | `SearchScreen` — across the whole archive |
| Media | Photo | `MediaGalleryScreen` — every image and video |
| Settings | Gear | `SettingsScreen` |

`EntriesScreen` (a folder's contents) is pushed on top of the stack, with a
back arrow and the folder's icon + name in the top app bar.

### 2.2 Navigation graph

```
NavHost(start = "folders")
├── folders        → FoldersScreen
├── search         → SearchScreen
├── media          → MediaGalleryScreen
├── settings       → SettingsScreen
├── folder/{id}    → EntriesScreen
├── entry/{id}     → EntryDetailScreen
└── export         → ExportActivity (SAF, separate activity)
```

The share target is **not** part of this graph. It is a separate activity
(`ShareTargetActivity`) with its own task, per
[04-ingestion.md](04-ingestion.md) §2.1.

### 2.3 Back navigation

System back always pops the stack. Back on a top-level destination exits the
app. From the share target, back cancels the share and returns to the source
app with `RESULT_CANCELED`.

### 2.4 Bottom sheet vs. full screen

Entry and folder actions (pin, tag, move, rename, delete, share) use a
**bottom sheet** — the native equivalent of a context menu, reachable by
thumb. On a tablet (width ≥ 840 dp) they use a side sheet instead.

---

## 3. Screens

### 3.1 Folders (home)

```
┌─────────────────────────────┐
│  Local Saved Messages   ⋮   │   ← top app bar
├─────────────────────────────┤
│  🔍  Search your archive    │   ← search entry point
├─────────────────────────────┤
│  💾  Saved Messages    142  │   ← folder row
│     Invoice for March  2m   │
│  ─────────────────────────── │
│  📁  Work                38  │
│     report.pdf          1h   │
│  ─────────────────────────── │
│  📁  Receipts             7  │
│     IMG_2043.jpg       3d   │
└─────────────────────────────┘
                    ⊕  ← FAB: new folder
```

- Each row: icon badge (emoji + colour), name, last-entry preview, timestamp,
  entry count.
- The three-dot button on a row is **always visible** (no hover state exists
  on Android) — it opens a bottom sheet with Rename / Change icon / Export
  folder / Delete.
- The first folder is protected and cannot be deleted.
- **Pull-to-refresh is absent** — there is nothing to refresh. It is replaced
  by a "Recalculate storage" action in Settings.
- A **"+ New folder"** FAB opens a small dialog with a name field and an
  emoji picker.

### 3.2 Entries (a folder)

```
┌─────────────────────────────┐
│  ←  💾  Saved Messages   ⋮   │
├─────────────────────────────┤
│  📌 Pinned                   │   ← if any pinned entry
├─────────────────────────────┤
│                             │
│  ── Today ──                │   ← date separators
│                             │
│  ┌───────────────────────┐  │
│  │ Invoice for March     │  │   ← text entry
│  │ 12:40                 │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ [thumb] invoice.pdf   │  │   ← file entry
│  │         PDF · 1.2 MB  │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  🏷 invoice  🔍 filter  ⇅    │   ← filter/sort toolbar
└─────────────────────────────┘
```

- Entries are grouped by day with a date separator, as in the web app.
- **Text entries** render the note in a bubble, right-aligned, with the time.
  A text entry that came from a shared *link* shows the URL as a tappable
  link.
- **File entries** render a thumbnail (image/video) or a type icon, the file
  name, the type and size, and the time.
- **A file with a note** shows the note above the file card.
- **Pinned entries** are collected in a strip at the top; tapping one scrolls
  to it.
- **Tap** an entry → `EntryDetailScreen`. **Long-press** → action sheet.
- The bottom toolbar offers the tag filter chips, a search-within-folder
  shortcut, and a sort toggle (newest / oldest / name).

### 3.3 Entry detail

```
┌─────────────────────────────┐
│  ←            ⋮             │
├─────────────────────────────┤
│                             │
│      [full preview]         │   ← image / video / audio / PDF
│                             │
│  ─────────────────────────  │
│  Note                       │
│  Invoice for March, paid    │
│  12 Oct 2026, 12:40         │
│  invoice.pdf · PDF · 1.2 MB │
├─────────────────────────────┤
│  ⤓ Download  ⤴ Share  🗑     │   ← action row
└─────────────────────────────┘
```

- A text-only entry shows the note large, with the metadata below.
- **Preview** is in-app for images, video, audio, and PDF (via
  `PdfRenderer` for a simple paginated view). Everything else offers
  "Open with…" to hand off to a system viewer.
- **Download** opens the system file manager or shares the file out. There is
  no separate "save to device" concept in v1 — the file is already on the
  device, inside the app.
- The action row: Share, Download, Pin, Tags, Rename note, Delete.

### 3.4 Search

- Searches the **whole archive**, not just one folder — the local archive's
  main value is finding something you saved weeks ago.
- Live search-as-you-type with a 200 ms debounce, over note text, body text,
  and file names (FTS4, see [03-local-data.md](03-local-data.md) §1.3).
- Each result shows the folder name, a highlighted snippet, the timestamp,
  and a thumbnail for files.
- Filter chips: by tag, by type (text / image / video / audio / document),
  and by date range.
- Tapping a result opens `EntryDetailScreen`.

### 3.5 Media

- A grid of every image and video in the archive, newest first.
- Sections by month.
- Tapping opens a full-screen pager with pinch-to-zoom and swipe between
  items.
- Videos play inline with a mute toggle.

### 3.6 Settings

| Section | Items |
|---------|-------|
| **Archive** | Storage used (with a breakdown), Export archive, Import archive, last export date |
| **Appearance** | Theme (System / Light / Dark), language (System / فارسی / English) |
| **Security** | "Require device lock" toggle — uses `BiometricPrompt` with `DEVICE_CREDENTIAL` fallback |
| **Folders** | Manage folders, protected-folder setting |
| **Support** | "Report a problem" — builds a local log file and shares it through the system share sheet |
| **About** | Version, build date, licence, "how to install" help, the zero-permission statement |

---

## 4. Gestures & interaction

| Gesture | Action |
|---------|--------|
| Tap a folder row | Open the folder |
| Long-press a folder row | Sheet: Rename / Icon / Export / Delete |
| Tap an entry | Open the detail |
| Long-press an entry | Sheet: Pin / Tags / Move / Share / Rename note / Delete |
| Double-tap an entry | Toggle "pinned" (a quick, native affordance) |
| Swipe an entry right | Quick-pin |
| Swipe an entry left | Quick-delete (with an undo snackbar) |
| Swipe a folder row left | Delete (with an undo snackbar) |
| Pinch to zoom in the media grid | Zoom the grid density |
| Pull to refresh | **Not present** — there is nothing to refresh |

### 4.1 Undo

Destructive actions (delete entry, delete folder) use a **snackbar with Undo**,
not a confirmation dialog. The deletion is not committed until the snackbar
expires (5 s), so "Undo" is genuinely free — a deliberate improvement over the
web app, which deletes immediately with no undo.

Deleting a **folder** is the exception: it deletes every entry inside it, so
it uses a confirmation dialog that names the number of entries. The undo
snackbar still applies after confirming.

### 4.2 Empty, loading, and error states

Every list and screen defines all three.

| State | Design |
|-------|--------|
| **Empty** | Icon + a one-line explanation + a primary action. E.g. "Nothing here yet. Share a file into this folder from any app." |
| **Loading** | Skeleton placeholders matching the final layout, not a centred spinner. |
| **Error** | Icon + message + a "Retry" action. Shown only when there is no cached data; with cached data, a transient error is a dismissible banner, never a blocking screen. |
| **First run** | A short onboarding card on the Folders screen explaining the share flow, with a "Share something now" action that fires an `ACTION_SEND` intent chooser. |

---

## 5. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Screen-reader labels | Every icon-only button has a `contentDescription`; decorative icons are `null` |
| Touch targets | ≥ 48 dp |
| Text scaling | Up to 200% without clipping; lists use lazy columns, not fixed-height containers |
| Contrast | ≥ 4.5:1 for body text, ≥ 3:1 for large text and icons |
| Colour is never the only signal | Pinned / tagged / protected states always carry an icon *and* a text label in the semantics |
| TalkBack | Swipe actions are announced; the file type and size are part of each entry's content description |
| Reduced motion | Compose animations respect the system's "remove animations" setting |
| RTL | `start`/`end` padding everywhere; auto-mirrored icons; the layout mirrors automatically |
| Persian typography | 1.6× line height, zero letter spacing, correct Yeh/Kaf forms — see [08](08-persian-localization.md) §3 |

---

## 6. No notifications, no accounts, no network

There is no notification permission, because nothing arrives in the
background — the app is a vault the user opens deliberately.

There is no `INTERNET` permission, so the app cannot talk to anything. This is
enforceable and verifiable from the manifest.

---

## 7. Screen inventory

| # | Screen | Route | Phase |
|---|--------|-------|-------|
| 1 | Folders | `folders` | 1 |
| 2 | Entries | `folder/{id}` | 1 |
| 3 | Entry detail | `entry/{id}` | 2 |
| 4 | Share target (picker) | (separate activity) | 1 |
| 5 | New/edit folder dialog | (dialog) | 1 |
| 6 | Entry action sheet | (bottom sheet) | 2 |
| 7 | Tag editor sheet | (bottom sheet) | 2 |
| 8 | Move-to-folder sheet | (bottom sheet) | 2 |
| 9 | Search | `search` | 3 |
| 10 | Media gallery | `media` | 3 |
| 11 | Media pager | (full screen) | 3 |
| 12 | Settings | `settings` | 4 |
| 13 | Export / Import | (SAF activity) | 4 |
