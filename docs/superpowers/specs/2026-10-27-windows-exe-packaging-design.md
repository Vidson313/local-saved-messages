# Windows Executable (NSIS Installer) Packaging Design

## 1. Overview
The goal is to package the Local Saved Messages Next.js application into a native Windows executable installer (`.exe` using NSIS via Electron and electron-builder). The application replicates Telegram's "Saved Messages" feature with offline persistence, real-time sync, and file upload capabilities.

## 2. Architecture & Components

### 2.1 Next.js Standalone Configuration
- Enable `output: 'standalone'` in `next.config.mjs`.
- During build, Next.js generates `.next/standalone` containing a self-contained Node server (`server.js`) and stripped-down dependencies.
- Build scripts copy required static assets:
  - `public/` -> `.next/standalone/public/`
  - `.next/static/` -> `.next/standalone/.next/static/`

### 2.2 Electron Main Process (`electron/main.js`)
- **Port Allocation**: Dynamically finds an available localhost port (defaulting to 3000, fallback to random unallocated ephemeral port).
- **Embedded Server Lifecycle**:
  - Spawns the standalone Next.js server via `child_process.fork` or `node` runtime.
  - Passes user data directories via environment variables:
    - `DATA_DIR`: `%APPDATA%\local-saved-messages\data`
    - `UPLOAD_DIR`: `%APPDATA%\local-saved-messages\uploads`
    - `PORT`: selected port
    - `HOSTNAME`: `127.0.0.1`
  - Polls `http://127.0.0.1:<PORT>/api/messages` until HTTP 200 before showing the main window.
- **Window Management**:
  - Native `BrowserWindow` with dimensions 1200x800 (minimum 800x600).
  - Custom app icon (`build/icon.ico`).
  - Auto-hide default menu bar (`autoHideMenuBar: true`).
  - External links (HTTP/HTTPS opening to external domains) open in the user's default web browser instead of navigating inside the Electron window.
- **Graceful Shutdown**:
  - On `window-all-closed` and `before-quit`, sends termination signal (SIGTERM/SIGINT) to the spawned Next.js server process and waits for clean exit.

### 2.3 Data Storage & Persistence in Windows
- In standard Windows installations (`C:\Program Files\Local Saved Messages`), the install directory is read-only for unprivileged users.
- By binding `DATA_DIR` and `UPLOAD_DIR` to `%APPDATA%\local-saved-messages\`, all messages (`messages.json`), chats (`chats.json`), and uploaded files (`uploads/`) persist safely across app updates, re-installations, and uninstalls.
- Directories are auto-created recursively on first launch if they do not exist.

### 2.4 Packaging & Installer Specification (NSIS)
- Packaging tool: `electron-builder`
- Target: `nsis` (Windows installer)
- Configuration (`electron-builder.json` or `package.json` build config):
  - `appId`: `com.localsavedmessages.app`
  - `productName`: `Local Saved Messages`
  - `win.target`: `nsis`
  - `nsis.oneClick`: false (allows user to select install folder and shortcuts)
  - `nsis.allowToChangeInstallationDirectory`: true
  - `nsis.createDesktopShortcut`: true
  - `nsis.createStartMenuShortcut`: true
  - `artifactName`: `SavedMessages-Setup-${version}.${ext}`

## 3. Build & Packaging Scripts
- `npm run build:electron`:
  1. `npm run build` (Next.js standalone build)
  2. `node scripts/prepare-electron.mjs` (copies `public` & `.next/static` to standalone output)
  3. `electron-builder --win nsis`

## 4. Verification & Testing
- Automated test suite `npm test` continues to pass.
- Verification that `dist/SavedMessages-Setup-1.0.0.exe` is generated.
- Verification that standalone server boots and responds on local port.
