# Windows Executable (NSIS Installer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the Local Saved Messages Next.js web application into a native Windows executable installer (`.exe` using NSIS via Electron and electron-builder).

**Architecture:** Configure Next.js for `standalone` output, build an Electron main process that manages the local Node server lifecycle and user data persistence in `%APPDATA%`, and bundle the application into a standard Windows NSIS installer using `electron-builder`.

**Tech Stack:** Next.js 15, Electron, electron-builder, Node.js, NSIS.

**Spec:** `docs/superpowers/specs/2026-10-27-windows-exe-packaging-design.md`

## Global Constraints
- Target platform: Windows (x64)
- Installer format: NSIS (`.exe`)
- All code, comments, and commit messages must be in clean English.
- No Claude attribution trailers or links in any commit message or code.
- Data and upload storage in production must reside in `%APPDATA%\local-saved-messages\`.
- All existing tests in `npm test` must continue to pass 100%.

## Review Focus
1. Port collision: If port 3000 is occupied by another application, Electron must find an available free port and start Next.js on that port.
2. Windows read-only install directory: Electron must redirect `DATA_DIR` and `UPLOAD_DIR` to `%APPDATA%` so unprivileged users can save messages and uploads.
3. Clean process termination: Closing the Electron window must cleanly terminate the background Node.js server to prevent zombie processes.
4. Static assets in standalone build: Standalone Next.js requires copying `public/` and `.next/static/` into `.next/standalone/` or UI styles and images will break.
5. External links: Clicking any external HTTP/HTTPS link inside the chat must open in the user's default Windows browser, not inside the Electron app frame.

---

### Task 1: Next.js Standalone Configuration and Asset Preparation Script

**Files:**
- Modify: `next.config.mjs`
- Create: `scripts/prepare-electron.mjs`
- Test: `scripts/test-electron-prep.mjs`

**Interfaces:**
- Produces: Complete `.next/standalone` folder populated with `.next/standalone/.next/static` and `.next/standalone/public` ready for distribution.

- [ ] **Step 1: Write the failing test for asset preparation**

Create `scripts/test-electron-prep.mjs`:
```javascript
import { promises as fs } from 'fs';
import path from 'path';
import assert from 'assert';

async function run() {
  console.log('Testing Electron asset preparation script...');
  const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  const publicDest = path.join(standaloneDir, 'public');

  // Verify that required directories exist
  const staticStat = await fs.stat(staticDest);
  assert(staticStat.isDirectory(), '.next/standalone/.next/static must be a directory');

  const publicStat = await fs.stat(publicDest);
  assert(publicStat.isDirectory(), '.next/standalone/public must be a directory');

  console.log('✓ Asset preparation test passed.');
}

run().catch((err) => {
  console.error('✗ Asset preparation test failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-electron-prep.mjs`
Expected: FAIL (standalone directory or static copy missing)

- [ ] **Step 3: Enable standalone in next.config.mjs and implement prepare-electron.mjs**

Update `next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

Create `scripts/prepare-electron.mjs`:
```javascript
import { promises as fs } from 'fs';
import path from 'path';

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function prepare() {
  const root = process.cwd();
  const standaloneDir = path.join(root, '.next', 'standalone');
  const staticSrc = path.join(root, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  const publicSrc = path.join(root, 'public');
  const publicDest = path.join(standaloneDir, 'public');

  console.log('Preparing standalone assets for Electron packaging...');

  try {
    await copyDir(staticSrc, staticDest);
    console.log('✓ Copied .next/static to standalone build');
  } catch (err) {
    console.error('Error copying .next/static:', err);
    throw err;
  }

  try {
    await copyDir(publicSrc, publicDest);
    console.log('✓ Copied public/ to standalone build');
  } catch (err) {
    console.error('Error copying public/:', err);
    throw err;
  }

  console.log('✓ Standalone Electron asset preparation complete.');
}

prepare().catch((err) => {
  console.error('Preparation failed:', err);
  process.exit(1);
});
```

- [ ] **Step 4: Build Next.js and run asset preparation and test**

Run:
```bash
npm run build && node scripts/prepare-electron.mjs && node scripts/test-electron-prep.mjs
```
Expected: PASS with "✓ Asset preparation test passed."

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs scripts/prepare-electron.mjs scripts/test-electron-prep.mjs
git commit -m "build: configure standalone Next.js build and asset preparation"
```

---

### Task 2: Electron Main Process & Lifecycle Management

**Files:**
- Create: `electron/main.cjs`
- Create: `electron/port.cjs`
- Test: `scripts/test-electron-port.mjs`

**Interfaces:**
- Consumes: `.next/standalone/server.js`, `DATA_DIR`, `UPLOAD_DIR`
- Produces: Standalone desktop runner managing window creation, server startup, and clean termination.

- [ ] **Step 1: Write test for dynamic port allocation**

Create `scripts/test-electron-port.mjs`:
```javascript
import assert from 'assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findFreePort } = require('../electron/port.cjs');

async function testPort() {
  console.log('Testing dynamic port allocation...');
  const port = await findFreePort(3000);
  assert(typeof port === 'number' && port >= 1024 && port <= 65535, 'Port must be a valid number');
  console.log(`✓ Port allocation returned valid port: ${port}`);
}

testPort().catch((err) => {
  console.error('✗ Port allocation test failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-electron-port.mjs`
Expected: FAIL (Cannot find module `../electron/port.cjs`)

- [ ] **Step 3: Implement port locator and Electron main process**

Create `electron/port.cjs`:
```javascript
const net = require('net');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(startPort = 3000, maxAttempts = 50) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const available = await isPortAvailable(port);
    if (available) return port;
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

module.exports = { findFreePort, isPortAvailable };
```

Create `electron/main.cjs`:
```javascript
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const childProcess = require('child_process');
const { findFreePort } = require('./port.cjs');

let mainWindow = null;
let serverProcess = null;

function waitForServer(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    }

    function retry() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for server at ${url}`));
      } else {
        setTimeout(check, 250);
      }
    }

    check();
  });
}

async function startServer(port) {
  const isDev = !app.isPackaged;
  const rootDir = isDev
    ? path.join(__dirname, '..')
    : path.join(process.resourcesPath, 'app');

  const standaloneServer = path.join(rootDir, '.next', 'standalone', 'server.js');

  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data');
  const uploadDir = path.join(userDataDir, 'uploads');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATA_DIR: dataDir,
    UPLOAD_DIR: uploadDir,
    NODE_ENV: 'production'
  };

  serverProcess = childProcess.fork(standaloneServer, [], {
    env,
    stdio: 'ignore'
  });

  serverProcess.on('error', (err) => {
    console.error('Server process error:', err);
  });
}

async function createWindow() {
  const port = await findFreePort(3000);
  await startServer(port);

  const serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${serverUrl}/api/messages`);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Local Saved Messages',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.startsWith(serverUrl)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(serverUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
    serverProcess = null;
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
```

- [ ] **Step 4: Run port test**

Run: `node scripts/test-electron-port.mjs`
Expected: PASS with "✓ Port allocation returned valid port"

- [ ] **Step 5: Commit**

```bash
git add electron/port.cjs electron/main.cjs scripts/test-electron-port.mjs
git commit -m "feat(electron): implement Electron main process and dynamic port locator"
```

---

### Task 3: App Icon Generation & Packaging Configuration

**Files:**
- Create: `scripts/generate-icon.mjs`
- Create: `build/icon.ico`
- Modify: `package.json`
- Create: `electron-builder.json`

**Interfaces:**
- Consumes: `sharp` (already in `devDependencies`)
- Produces: Windows multi-resolution icon (`build/icon.ico`) and configured `electron-builder.json`.

- [ ] **Step 1: Create icon generator script**

Create `scripts/generate-icon.mjs` using SVG/PNG via `sharp` to produce PNGs and combine into `.ico`:
```javascript
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateIcon() {
  const buildDir = path.join(process.cwd(), 'build');
  await fs.mkdir(buildDir, { recursive: true });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2AABEE" />
        <stop offset="100%" stop-color="#229ED9" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="60" fill="url(#grad)" />
    <!-- Telegram Saved Messages Bookmark Icon -->
    <path d="M78 52 C70 52 64 58 64 66 L64 204 C64 211 72 215 78 211 L128 174 L178 211 C184 215 192 211 192 204 L192 66 C192 58 186 52 178 52 Z" fill="#FFFFFF" />
  </svg>`;

  const png256 = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  await fs.writeFile(path.join(buildDir, 'icon.png'), png256);

  // Simple Windows ICO header writer for 256x256 PNG container (standard Windows Vista+ ICO format)
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // type: 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // count: 1 image

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(0, 0);   // width 256 (0 = 256)
  icoEntry.writeUInt8(0, 1);   // height 256 (0 = 256)
  icoEntry.writeUInt8(0, 2);   // color palette
  icoEntry.writeUInt8(0, 3);   // reserved
  icoEntry.writeUInt16LE(1, 4); // color planes
  icoEntry.writeUInt16LE(32, 6); // bits per pixel
  icoEntry.writeUInt32LE(png256.length, 8); // size of image data
  icoEntry.writeUInt32LE(22, 12); // offset of image data (6 header + 16 entry = 22)

  const icoBuffer = Buffer.concat([icoHeader, icoEntry, png256]);
  await fs.writeFile(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('✓ Generated build/icon.png and build/icon.ico successfully.');
}

generateIcon().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run icon generation**

Run: `node scripts/generate-icon.mjs`
Expected: PASS with "✓ Generated build/icon.png and build/icon.ico successfully."

- [ ] **Step 3: Create electron-builder.json**

Create `electron-builder.json`:
```json
{
  "appId": "com.localsavedmessages.app",
  "productName": "Local Saved Messages",
  "directories": {
    "output": "dist",
    "buildResources": "build"
  },
  "files": [
    "electron/**/*",
    ".next/standalone/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": ".next/standalone",
      "to": "app/.next/standalone",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": "nsis",
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Local Saved Messages",
    "artifactName": "SavedMessages-Setup-${version}.${ext}"
  }
}
```

- [ ] **Step 4: Update package.json scripts and install dependencies**

Add to `package.json`:
- `"main": "electron/main.cjs"`
- Scripts:
  - `"build:electron": "next build && node scripts/prepare-electron.mjs && electron-builder --win nsis"`
  - `"pack:electron": "next build && node scripts/prepare-electron.mjs && electron-builder --dir"`
Install `electron` and `electron-builder` as `devDependencies`:
```bash
npm install --save-dev electron@^34.0.0 electron-builder@^25.1.8
```

- [ ] **Step 5: Commit**

```bash
git add build/ package.json package-lock.json electron-builder.json scripts/generate-icon.mjs
git commit -m "build(electron): add icon generator, electron-builder config, and package scripts"
```

---

### Task 4: Packaging NSIS Installer and Validation

**Files:**
- Execute build: `npm run build:electron`
- Verification: `dist/SavedMessages-Setup-1.0.0.exe`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: 100% PASS on all storage, SSE, upload security, and UX tests.

- [ ] **Step 2: Build the Windows NSIS Installer**

Run: `npm run build:electron`
Expected: Build completes successfully; generates `dist/SavedMessages-Setup-1.0.0.exe`.

- [ ] **Step 3: Verify the generated installer**

Run check script:
```bash
test -f dist/SavedMessages-Setup-1.0.0.exe && echo "Installer successfully created"
```
Expected: "Installer successfully created"

- [ ] **Step 4: Commit build documentation and configuration updates**

```bash
git add .
git commit -m "chore: finalize Windows NSIS executable packaging configuration"
```
