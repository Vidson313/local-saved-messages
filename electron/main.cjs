const { app, BrowserWindow, shell, dialog } = require('electron');
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
        // Require explicit HTTP 200 to confirm the application server is ready
        if (res.statusCode === 200) {
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

function resolveStandaloneServer() {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '..', '.next', 'standalone', 'server.js');
  }

  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'standalone', 'server.js'),
    path.join(process.resourcesPath, 'standalone', 'server.js'),
    path.join(process.resourcesPath, 'app', '.next', 'standalone', 'server.js'),
    path.join(process.resourcesPath, '.next', 'standalone', 'server.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function startServer(port) {
  const standaloneServer = resolveStandaloneServer();
  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data');
  const uploadDir = path.join(userDataDir, 'uploads');
  const logFile = path.join(userDataDir, 'server.log');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  if (!standaloneServer || !fs.existsSync(standaloneServer)) {
    const errorMsg = `Next.js standalone server file not found in package resources.`;
    fs.writeFileSync(logFile, `${new Date().toISOString()} - ERROR: ${errorMsg}\n`, { flag: 'a' });
    dialog.showErrorBox('Server Not Found', errorMsg);
    throw new Error(errorMsg);
  }

  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  logStream.write(`\n--- Starting server at ${new Date().toISOString()} on port ${port} ---\n`);

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATA_DIR: dataDir,
    UPLOAD_DIR: uploadDir,
    NODE_ENV: 'production'
  };

  serverProcess = childProcess.fork(standaloneServer, [], {
    env,
    cwd: path.dirname(standaloneServer),
    stdio: ['ignore', logStream, logStream, 'ipc']
  });

  serverProcess.on('error', (err) => {
    const errText = `${new Date().toISOString()} - Server process error: ${err.message}\n`;
    try {
      fs.writeFileSync(logFile, errText, { flag: 'a' });
    } catch {
      // ignore
    }
  });

  serverProcess.on('exit', (code, signal) => {
    const exitText = `${new Date().toISOString()} - Server process exited with code ${code}, signal ${signal}\n`;
    try {
      fs.writeFileSync(logFile, exitText, { flag: 'a' });
    } catch {
      // ignore
    }
  });
}

async function createWindow() {
  try {
    const port = await findFreePort(3000);
    await startServer(port);

    const serverUrl = `http://127.0.0.1:${port}`;
    await waitForServer(`${serverUrl}/api/messages`);

    const serverOrigin = new URL(serverUrl).origin;

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

    // Strict URL origin checking to prevent external in-app window navigation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === serverOrigin) {
          return { action: 'allow' };
        }
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
          shell.openExternal(url);
        }
      } catch {
        // Reject malformed URLs
      }
      return { action: 'deny' };
    });

    mainWindow.loadURL(serverUrl);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start application:\n${err.message}\n\nPlease check server.log in ${app.getPath('userData')}`
    );
    app.quit();
  }
}

function stopServer() {
  if (serverProcess) {
    try {
      if (serverProcess.connected) {
        serverProcess.disconnect();
      }
      serverProcess.kill();
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
