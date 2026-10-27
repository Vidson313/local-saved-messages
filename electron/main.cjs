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
