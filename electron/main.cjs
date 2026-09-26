const { app, BrowserWindow, session } = require('electron');
const { createServer } = require('node:http');
const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
};

let server;
let mainWindow;
let appOrigin;

function serveBuiltApp(distDir) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }

    const filePath = path.resolve(distDir, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(distDir, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
      response.writeHead(404).end();
      return;
    }

    try {
      if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
      const headers = {
        'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:",
      };
      if (request.method === 'HEAD') {
        response.writeHead(200, headers).end();
      } else {
        response.writeHead(200, headers).end(await readFile(filePath));
      }
    } catch {
      response.writeHead(404).end();
    }
  });
}

async function createWindow() {
  const devOrigin = process.env.ZOMBIE_DEV_ORIGIN;
  if (devOrigin && /^http:\/\/127\.0\.0\.1:\d+$/.test(devOrigin)) {
    appOrigin = devOrigin;
  } else {
    const distDir = path.join(app.getAppPath(), 'dist');
    server = serveBuiltApp(distDir);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    appOrigin = `http://127.0.0.1:${server.address().port}`;
  }

  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  mainWindow = new BrowserWindow({
    title: 'Zombie Fire Suppression Sim',
    width: 1600,
    height: 1000,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#17242b',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, destination) => {
    try {
      if (new URL(destination).origin === appOrigin) return;
    } catch {}
    event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(`${appOrigin}/`);
  if (devOrigin) {
    // A File Provider notification can briefly restart Vite during a reload.
    // Recover a page whose entry modules failed to load in that interval.
    let lastRetry = 0;
    const recovery = setInterval(async () => {
      if (!mainWindow || mainWindow.isDestroyed()) { clearInterval(recovery); return; }
      try {
        const empty = await mainWindow.webContents.executeJavaScript(
          'document.readyState === "complete" && document.querySelector("#root")?.childElementCount === 0', true);
        if (!empty || Date.now() - lastRetry < 10_000) return;
        const response = await fetch(`${appOrigin}/src/main.tsx`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) { lastRetry = Date.now(); mainWindow.webContents.reload(); }
      } catch { /* wait for the local server to recover */ }
    }, 5000);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow).catch(error => {
    console.error('Unable to open Zombie Fire Suppression Sim:', error);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => server?.close());
}
