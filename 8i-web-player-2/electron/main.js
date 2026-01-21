const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const path = require('path');
const { createContentServer, createWebServer } = require('./server');
const fs = require('fs');

// Enable GPU acceleration and WebGL
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-webgl2-compute-context');
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('use-angle', 'metal'); // Use Metal on macOS for best performance

let mainWindow;
let contentServer;
let webServer;
let contentPort = 8888;
let webPort = 1234;
let currentContentPath = null;

// Get the correct path for resources depending on dev vs packaged
function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', relativePath);
  }
  return path.join(__dirname, '..', relativePath);
}

// Find manifest files in a directory
function findManifests(dir, relativePath = '') {
  const manifests = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        manifests.push(...findManifests(fullPath, relPath));
      } else if (entry.name === 'manifest.mpd') {
        manifests.push(relPath);
      }
    }
  } catch (err) {
    console.error('Error scanning directory:', err);
  }
  return manifests;
}

// Select content folder
async function selectContentFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Content Folder',
    properties: ['openDirectory'],
    message: 'Select the folder containing volumetric mesh content (with manifest.mpd files)'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

// Load content and start playback
async function loadContent(contentPath) {
  currentContentPath = contentPath;

  // Stop existing server if running
  if (contentServer) {
    contentServer.close();
  }

  // Start content server
  contentServer = createContentServer(contentPath, contentPort);

  // Find manifests
  const manifests = findManifests(contentPath);

  if (manifests.length === 0) {
    dialog.showErrorBox('No Content Found', 'No manifest.mpd files found in the selected folder.');
    return;
  }

  // Use first manifest
  const manifest = manifests[0];

  // Start web server to serve the player (avoids file:// CORS issues)
  const webPlayerPath = getResourcePath('dist');
  if (!webServer) {
    webServer = createWebServer(webPlayerPath, webPort);
  }

  // Load the player via HTTP instead of file://
  const url = `http://127.0.0.1:${webPort}/index.html?contentPort=${contentPort}&manifest=${encodeURIComponent(manifest)}`;
  console.log('Loading URL:', url);

  mainWindow.loadURL(url);

  // Update window title
  const contentName = path.basename(path.dirname(path.join(contentPath, manifest)));
  mainWindow.setTitle(`Volumetric Mesh Viewer - ${contentName}`);
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Content Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const contentPath = await selectContentFolder();
            if (contentPath) {
              await loadContent(contentPath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (currentContentPath) {
              loadContent(currentContentPath);
            }
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Required for loading local files with file:// protocol
      webgl: true,
      enableWebSQL: false,
      spellcheck: false,
      // Enable hardware acceleration
      offscreen: false
    },
    titleBarStyle: 'default',
    title: 'Volumetric Mesh Viewer',
    backgroundColor: '#1a1a2e',
    show: false
  });

  // Log GPU info on ready
  mainWindow.webContents.on('did-finish-load', () => {
    // Check WebGL support
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
          const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
          console.log('[Electron] WebGL supported - Vendor:', vendor, 'Renderer:', renderer);
          return { supported: true, vendor, renderer };
        } else {
          console.error('[Electron] WebGL NOT supported!');
          return { supported: false };
        }
      })()
    `).then(result => {
      console.log('WebGL check result:', result);
    }).catch(err => {
      console.error('WebGL check error:', err);
    });
  });

  // Log console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[Renderer ${levels[level] || level}] ${message}`);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Create menu
  createMenu();

  // Bundled content path - in dev it's relative, in packaged app it's in resources
  const bundledContentPath = app.isPackaged
    ? path.join(process.resourcesPath, 'content')
    : path.join(__dirname, '..', '..', 'local-content');

  // Auto-load bundled content
  if (fs.existsSync(bundledContentPath) && findManifests(bundledContentPath).length > 0) {
    await loadContent(bundledContentPath);
  } else {
    // Fallback: show error and prompt
    dialog.showErrorBox('Content Not Found',
      `Bundled content not found at: ${bundledContentPath}\n\nPlease use File > Open Content Folder to select content.`);
    const playerPath = getResourcePath('dist/index.html');
    mainWindow.loadFile(playerPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle file open on macOS (drag to dock icon)
app.on('open-file', async (event, filePath) => {
  event.preventDefault();

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    if (mainWindow) {
      await loadContent(filePath);
    } else {
      app.whenReady().then(async () => {
        await createWindow();
        await loadContent(filePath);
      });
    }
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (contentServer) {
    contentServer.close();
  }
  if (webServer) {
    webServer.close();
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
