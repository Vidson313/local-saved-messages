# 06 — Roadmap

Six phases. Each phase ends with a **shippable APK** — the app is usable after
phase 1 and gets better from there. No phase is a "throwaway spike".

---

## Phase 0 — Documentation *(current)*

**Goal:** a design that can be implemented without further decisions.

- [x] Product scope and the offline-first decision — [01](01-product-scope.md)
- [x] Architecture and layer contracts — [02](02-architecture.md)
- [x] Local data model, file storage, export/import — [03](03-local-data.md)
- [x] Ingestion design — [04](04-ingestion.md)
- [x] UI/UX specification — [05](05-ui-ux.md)
- [x] Known web-app defects to avoid — [07](07-known-web-issues.md)
- [ ] **Review and approval by the user**
- [ ] Scaffold the Gradle project
- [ ] **Verify the Bazaar requirements** (signing behaviour, APK vs AAB, privacy-policy rules, listing assets) — see the checklist in `README.md`

**Exit criteria:** every open question in `README.md` is answered, and the
user has approved the scope.

---

## Phase 1 — The core loop

**Goal:** a user can share a file from Telegram into a folder and read it back,
offline.

### Work

| Area | Detail |
|------|--------|
| Project setup | Gradle 8.x, version catalog, `minSdk 26`, `targetSdk` current, Compose, Room, DataStore, Coil, KSP |
| **Release keystore** | Created now, backed up in two separate physical locations. This is the single irreversible risk in the whole project. |
| **Localisation** | `values/` (English) and `values-fa/` (Persian) from the first commit. `supportsRtl="true"`. Persian is the default locale. |
| Theme | Material 3, the web app's palette, light/dark/system, no flash of the wrong theme |
| Database | Room entities, DAOs, migrations, the FTS4 virtual table and its triggers |
| Folders | List, create, rename, recolour, delete (with the protected first folder) |
| Entries | List grouped by day, file cards with thumbnails, text entries |
| Share target | `ShareTargetActivity`, intent parsing, streaming file import, the folder picker with the note field |
| File storage | `FileStore` with the `yyyy/mm` layout, promotion out of the staging area, hard delete |
| Icons | The web app's `icon.svg` ported as an adaptive icon |
| Build variants | `debug` with `applicationIdSuffix = ".debug"`, `release` with the release keystore; a universal APK with both ABIs |

### Acceptance criteria

| # | Criterion |
|---|-----------|
| P1.1 | Sharing a downloaded file from Telegram appears in the system share sheet as "Local Saved Messages" |
| P1.2 | The picker opens with no configuration, shows the file preview, and saves to a chosen folder |
| P1.3 | The saved file is byte-identical to the source and readable after Telegram's cache is cleared |
| P1.4 | The app declares **no permissions at all** — verified by dumping the merged manifest |
| P1.5 | Cancelling the picker leaves nothing in permanent storage |
| P1.6 | The app launches cold and renders the folder list with no loading flash |
| P1.7 | The UI renders correctly in Persian with a mirrored layout, and in English |
| P1.8 | The release keystore is generated, and a signed release APK installs and runs |
| P1.9 | `npm test` and `npm run build` in the web app still pass (the Android work must not touch the web app) |

---

## Phase 2 — Managing entries

**Goal:** the archive becomes usable day to day.

### Work

| Area | Detail |
|------|--------|
| Entry detail | Full preview for image / video / audio / PDF, metadata, actions |
| Entry actions | Pin, tags, move to folder, rename note, delete with undo, share out |
| FileProvider | Sharing entries back out to other apps |
| Swipe actions | Quick-pin, quick-delete with undo |
| Soft delete | The `hidden` flag, the 5-second undo window, and the confirming job |
| Tag editor | Add/remove tags, filter chips |
| Previews | PDF via `PdfRenderer`, video via `ExoPlayer`/Media3, audio via `MediaPlayer` |

### Acceptance criteria

| # | Criterion |
|---|-----------|
| P2.1 | Long-press an entry → action sheet with all eight actions |
| P2.2 | Delete is reversible for 5 seconds via a snackbar |
| P2.3 | Deleting an entry removes its file from disk, and only that file |
| P2.4 | Sharing an entry out hands another app a readable file |
| P2.5 | Pinning an entry moves it to the pinned strip and it survives an app restart |
| P2.6 | Moving an entry to another folder updates both lists immediately |

---

## Phase 3 — Finding things

**Goal:** the archive is searchable.

### Work

| Area | Detail |
|------|--------|
| Search | FTS4 over note, body, and file name; 200 ms debounce; highlighted snippets |
| Search safety | The `MATCH` string is quoted so a user's punctuation cannot inject FTS operators |
| Filters | By tag, by type, by date range |
| Media gallery | A grid of every image and video, grouped by month, with a full-screen pager |
| Onboarding | A first-run card explaining the share flow, with a "share something now" action |

### Acceptance criteria

| # | Criterion |
|---|-----------|
| P3.1 | Search returns matching entries from any folder, ranked by date |
| P3.2 | Search for `don't` and for `a "b" c` returns results instead of erroring |
| P3.3 | A search for a file name finds the file entry |
| P3.4 | The media grid shows every image and video with a thumbnail |
| P3.5 | Search over 5 000 entries completes in under 150 ms on a mid-range device |

---

## Phase 4 — Keeping the data safe

**Goal:** the user can never lose the archive to an accident.

### Work

| Area | Detail |
|------|--------|
| Export | A single `.zip` written through SAF, streamed, with a `manifest.json` |
| Import | Read a zip, validate the manifest, merge or replace, rebuild the FTS index |
| Storage readout | Usage by type in Settings, with the free-space warning thresholds |
| Device lock | `BiometricPrompt` with a `DEVICE_CREDENTIAL` fallback |
| Backup nudge | A one-time snackbar after the first successful save |
| Settings | Theme, device lock, folder management, about, install help |

### Acceptance criteria

| # | Criterion |
|---|-----------|
| P4.1 | Export produces a zip containing every entry and file; a fresh install can import it and see the same archive |
| P4.2 | Importing the same archive twice does not create duplicate rows (ids are prefixed) |
| P4.3 | Import rejects an archive with an unknown format version, with a clear message |
| P4.4 | "Replace" mode wipes the current archive only after an explicit confirmation |
| P4.5 | The device lock uses the system credential and stores nothing itself |
| P4.6 | Export progress is shown and a cancelled export leaves no partial zip |

---

## Phase 5 — Polish and hardening

**Goal:** the app is comfortable to use every day, and ready for the store.

### Work

| Area | Detail |
|------|--------|
| Onboarding | A first-run flow: create the first folder, see what the app does |
| Accessibility pass | TalkBack order, 200% text scale, contrast audit, reduced motion |
| RTL verification | The layout mirrors correctly in a Persian locale, on every screen |
| Performance | Baseline profiles, `LazyColumn` keys, image downsampling, cold-start timing |
| **Support channel** | A "Report a problem" action that builds a log file locally and hands it to the user through the app's own share sheet — so it reaches the developer's Telegram. No crash-reporting SDK, no `INTERNET`. |
| **Bazaar listing assets** | Icon at every required size, a feature graphic, screenshots in Persian, a short and a long description, a privacy-policy page, a content rating |
| **Privacy policy** | A public page: no data is collected, transmitted, or shared; the app requests no permissions |
| **Release build** | A versioned, signed universal APK with an incremented `versionCode` |
| Install documentation | A page in the repo covering both the Bazaar install and direct sideloading |

### Acceptance criteria

| # | Criterion |
|---|-----------|
| P5.1 | Cold start to first frame under 400 ms on a mid-range device |
| P5.2 | Scrolling 1 000 entries holds 60 fps with thumbnails |
| P5.3 | The app passes TalkBack on every screen |
| P5.4 | The layout is correct at 200% font scale with no clipped text, in both Persian and English |
| P5.5 | Every screen mirrors correctly in RTL, with no hard-coded `left`/`right` |
| P5.6 | The report action produces a log file and shares it through the system share sheet |
| P5.7 | A signed release APK installs over the previous version without losing the archive |
| P5.8 | The merged manifest contains zero permissions |
| P5.9 | The listing assets and the privacy-policy page are ready to upload |

---

## Phase 6 — Optional: syncing with the web app

**Not committed.** Listed because the schema was designed for it
([01](01-product-scope.md) §4), and because the user may want it later.

Scope if it happens: a `SyncCoordinator` with an outbox, an SSE client, and
server-side changes (`replyToId`, idempotency keys). It would be a
**separate** phase with its own PR, and the local app must keep working with
the network off — sync would be strictly additive.

---

## Cross-cutting: what is deliberately absent

| Absent | Reason |
|--------|--------|
| Push notifications | Nothing arrives in the background |
| Any network permission | The app is offline by design — and the empty permission list is a selling point on the Bazaar listing |
| Accounts / sign-in | A personal vault on one device |
| Cloud backup | `allowBackup="false"`; the user may not want their archive in the cloud. Export is manual. |
| In-app update checker | The Bazaar store handles updates, and it would need `INTERNET` |
| Crash-reporting SDK | It would need `INTERNET` and would upload user data. The local log file + share sheet covers it. |
| Reading Telegram's database | Private format, needs root, breaks on updates |
| TDLib / MTProto | Needs `api_id`, 2FA, session management — a sync concern, not an ingestion one |
| iOS | Out of scope |
| Widgets | A nice-to-have for later; no data arrives, so a widget would only mirror what the app already shows |
