# Android Client — Local Saved Messages

**Offline-first Android client.** A personal, self-contained vault of messages
and files, built around one input path: *share anything from Telegram (or any
other app) straight into it.*

This folder holds every Android-related artifact in the repository: the Gradle
project, native source, assets, and design documentation.

---

## Status

**Phase 0 — Documentation & design. No code written yet.**

| Document | Purpose |
|----------|---------|
| [docs/01-product-scope.md](docs/01-product-scope.md) | What v1 is, what it is not, and the product decisions behind it |
| [docs/02-architecture.md](docs/02-architecture.md) | Tech stack, module layout, data flow, layer contracts |
| [docs/03-local-data.md](docs/03-local-data.md) | SQLite schema, file storage on disk, export/import |
| [docs/04-ingestion.md](docs/04-ingestion.md) | The Telegram Share Sheet path — the core feature of v1 |
| [docs/05-ui-ux.md](docs/05-ui-ux.md) | Screens, navigation, gestures, Material 3 theming, RTL |
| [docs/06-roadmap.md](docs/06-roadmap.md) | Phased delivery plan with acceptance criteria per phase |
| [docs/07-known-web-issues.md](docs/07-known-web-issues.md) | Bugs in the web app that this client must not inherit |
| [docs/08-persian-localization.md](docs/08-persian-localization.md) | Persian as the default locale, RTL layout, number and date formatting |
| [docs/09-design-tokens.md](docs/09-design-tokens.md) | The single source of truth for colour, type, spacing, shape and icons |
| [docs/10-stitch-review.md](docs/10-stitch-review.md) | The Stitch design review — false security claims, inert affordances, layout defects |

---

## The product in one paragraph

You open Telegram, tap a **downloaded** file, hit **Share**, and pick
**Local Saved Messages**. The app opens on a screen where you choose which
"chat" (folder) to drop it into, optionally type a note, and press send. The
file is copied into the app's private storage and the entry is written to a
local database. **No network is involved at any point.** Later — on a plane, on
a train, with the phone in airplane mode — everything you have saved is there,
fully browsable and searchable.

This is deliberately **not** a port of the web app. The web app is a
network-dependent client of a server. This app is a **local vault** with a
convenient way to fill it. See
[01-product-scope.md](docs/01-product-scope.md) for the full scope, including
the deliberate decision to not sync with the web app in v1.

---

## Design principles

1. **Offline is the only mode.** There is no "connecting", no sync status chip,
   no retry queue. The app has no network code at all in v1. This is not a
   limitation to be worked around later — it is a simpler product.
2. **Local is the source of truth.** The SQLite database *is* the app. There
   is no server, no reconciliation, no conflict resolution.
3. **The user's data belongs to the user.** The app ships a full
   export/import (JSON + files). Bazaar installs are updated in place, so a
   broken update is unrecoverable — the export is the safety net. See
   [03-local-data.md](docs/03-local-data.md) §5.
4. **Native, not a wrapper.** No WebView, no Capacitor, no TWA. Real Compose
   UI, real SQLite, real Android share targets.
5. **No inherited web bugs.** Every defect catalogued in
   [07-known-web-issues.md](docs/07-known-web-issues.md) is designed out.
6. **One language, one layout.** Kotlin + Jetpack Compose only.
7. **No network, ever.** The app never requests `INTERNET`, and no future
   feature may. The only runtime permission is `RECORD_AUDIO`, requested at
   the moment the user records a voice note. The Bazaar listing shows this
   permission list; it is a feature, not an accident.

---

## Target stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Kotlin 2.x | Coroutines, null-safety, first-class Android |
| UI | Jetpack Compose + Material 3 | Declarative; native look and feel |
| Architecture | Single module, feature-first packages, MVVM + unidirectional data flow | One app, small team — no multi-module ceremony |
| Async | Coroutines + Flow | Native structured concurrency |
| Local DB | Room (SQLite) | Type-safe DAOs, transactional writes |
| File storage | App-private storage + MediaStore for exports | No storage permission needed |
| Preferences | DataStore (Preferences) | Async; no blocking `localStorage` equivalent |
| Images | Coil | Loads local `content://` URIs and file paths |
| DI | Manual container (`AppContainer`) | ~12 objects; Hilt would be ceremony |
| Tests | JUnit5 + Robolectric + Turbine | Room and Compose need instrumentation or JVM equivalents |

**Rejected alternatives**

- *React Native / Expo* — shares no code with the Next.js app, adds a JS bridge,
  and the storage layer would be rewritten anyway.
- *PWA / TWA* — the user asked for a native app; also the web app's service
  worker explicitly skips `/api/`, so it is not offline-capable today.
- *Kotlin Multiplatform* — the shareable logic would be ~5% of the codebase
  (JSON models only).
- *Hilt* — annotation-processor cost for a graph this small.
- *Now in Android / modularization* — premature for one module.

---

## Platform targets

| Setting | Value | Why |
|---------|-------|-----|
| `minSdk` | **26** (Android 8.0) | Maximum reach; the app avoids every API that needs a compat branch |
| `targetSdk` | current stable (35/36) | Correct behaviour on new devices |
| `compileSdk` | current stable | Latest APIs |
| Distribution | **Bazaar (بازار)** — APK, plus a sideloaded copy for direct installs | The primary channel; see §Distribution |
| Languages | **Persian (default) + English** | The Bazaar audience is Persian-speaking; RTL is required |
| ABI | `arm64-v8a` + `armeabi-v7a` | Universal APK covers every device |
| Signature | One release keystore, backed up off-device | The signing key is the trust anchor |
| `versionCode` | Strictly increasing, never reused | Bazaar updates are delivered by the store |

### Why API 26 is the floor

`minSdk 26` is chosen for **reach**, and the app's design makes the
compatibility cost close to zero. The reason Android 8-era devices are
usually expensive is scoped storage, and this app sidesteps that entirely:

| Android 8–10 concern | Why it does not apply here |
|---------------------|----------------------------|
| `WRITE_EXTERNAL_STORAGE` / `requestLegacyExternalStorage` | The app never touches shared storage. Files live in app-private `filesDir`; they enter and leave only through SAF and `FileProvider`. |
| Notification channels (API 26+) | The app has no notifications. |
| Adaptive icons (API 26+) | Supported at the floor. API 25 and below are out of scope, so a legacy icon is unnecessary. |
| `BiometricPrompt` | Available via `androidx.biometric` back to API 23. |
| `java.time` | Core library desugaring via AGP. |
| Background restrictions | No background work at all — no `WorkManager`, no services, no alarms. |

The one real cost is a slightly wider test matrix. The build produces a
**universal APK** (both ABIs) so there is no per-ABI distribution problem.

### Distribution: Bazaar (بازار)

**Confirmed decision:** the app will be published on the Bazaar app store
after it is built.

What this changes, concretely:

| Concern | Consequence |
|---------|-------------|
| **Signing key** | The release keystore must be created in phase 1 and backed up in two separate physical locations before the first upload. If Bazaar stores the APK with the developer's own signature, a lost key means the app can never be updated again — only republished under a new package name. **Verify Bazaar's re-signing behaviour before the first upload.** |
| **No self-update check** | A Bazaar install is updated by the store, so an in-app update checker is removed from scope. It would also have required the `INTERNET` permission, which the app must not have. |
| **Privacy policy** | A public URL describing the app is required for the listing. The content is unusually simple: *no data is collected, transmitted, or shared; the app does not even request internet access.* |
| **Permission list is a selling point** | Bazaar displays the app's permissions. This app requests **none** — no internet, no storage, no camera, no location. That is a genuine differentiator and must be preserved. |
| **Localisation is required, not optional** | Persian is the default locale with real RTL layout; English is the secondary. All strings live in `strings.xml` from phase 1, so this is resource work, not a rewrite. |
| **Version management** | `versionCode` strictly increases with every upload; a `versionName` in `MAJOR.MINOR.PATCH` form. The store may reject a duplicate `versionCode`. |
| **Update safety** | The "no destructive migration" rule becomes a hard requirement: an update that drops a user's archive is unacceptable in a published app. |
| **Debug builds** | `applicationIdSuffix = ".debug"` so a development build and the Bazaar build can coexist on one device without a signature conflict. |
| **Review cycle** | The first submission is likely to be rejected for a missing privacy policy URL, a low-res icon, or a missing content rating. Budget for one round of corrections. |

### Support channel

Bazaar listings do not give developers a crash-report console, so support is
handled **inside the app, without the network**:

- A **"Report a problem"** action in Settings builds a log file (app version,
  device, the last N app-level events) and hands it to the user through the
  **same share sheet the app already implements** — so it goes to the
  developer's Telegram in one tap.
- The Bazaar listing's own review/comment section is the secondary channel.

No crash-reporting SDK, because every such SDK needs `INTERNET` and uploads
user data. The log file is generated locally and only leaves the device if
the user explicitly shares it.

### Versioning policy

| Change | `versionCode` | `versionName` |
|--------|---------------|---------------|
| New feature, bug fix, copy change | +1 | `1.1.0`, `1.0.1` |
| Schema change (with a migration) | +1 | `1.1.0` |
| First Bazaar release | 1 | `1.0.0` |
| Re-upload after a rejection | unchanged | unchanged |

`versionCode` is never reused, and never decreases — Bazaar treats a lower
code as a downgrade and rejects it.

---

## Repository layout (planned)

```
android/
├── README.md                    # this file
├── docs/                        # design documents (phase 0)
├── gradle/                      # Gradle wrapper
├── gradle/libs.versions.toml    # version catalog
├── build.gradle.kts             # root build config
├── settings.gradle.kts          # module + plugin management
├── gradle.properties
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── java/com/localsavedmessages/app/
        │   │   ├── core/           # dispatchers, Result, logging, time
        │   │   ├── data/
        │   │   │   ├── local/      # Room entities, DAOs, database
        │   │   │   ├── files/      # file import, thumbnails, export
        │   │   │   └── repository/ # single source of truth per domain
        │   │   ├── domain/         # models, use cases (pure Kotlin)
        │   │   ├── ingestion/      # share-target handling, intent parsing
        │   │   └── ui/             # Compose screens, theme, navigation
        │   └── res/                # icons, strings, themes, xml configs
        └── test/                   # unit tests
```

---

## Open questions for the review round

1. **Folders ("chats") vs. a flat archive?** The user described choosing a
   destination folder, so folders are in scope. Should there also be
   *sub-folders*? **Recommended: no** — flat list of folders, tags for
   cross-cutting organisation.
2. **Should the app read Telegram's local database directly?** **No.** The
   format is private, undocumented, encrypted, and breaks on every update;
   the Android copy needs root. The Share Sheet is the supported path.
3. **Search scope in v1:** full-text over message text and file names.
   **Recommended: yes**, it is the main reason to keep a local archive.
4. **Auto-delete / storage cap:** a personal archive should not silently
   delete. **Recommended: never auto-delete; show storage usage in Settings.**

### To verify before the first Bazaar upload

These need checking against Bazaar's actual requirements, and each one can
change a phase-1 decision:

1. **Does Bazaar re-sign the APK, or keep the developer's signature?** If it
   keeps it, the keystore must be created and backed up before the first
   upload — losing it ends the ability to update the app.
2. **APK or AAB?** AAB is expected to be APK-only; if so, a universal APK
   with both ABIs is the deliverable.
3. **Is a privacy-policy URL mandatory?** The content is short: no data is
   collected or transmitted, and the app requests no permissions.
4. **Any minimum `targetSdk` or `minSdk` enforced by the store?**
5. **Required listing assets:** icon sizes, feature graphic, screenshots,
   content rating, and category.
6. **Is a developer account or a company registration required?**
