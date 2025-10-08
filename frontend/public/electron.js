const { app, BrowserWindow, protocol, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

// Register protocol BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      allowServiceWorkers: true,
      bypassCSP: true
    }
  }
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: !isDev,       // Only fullscreen in production
    kiosk: !isDev,            // Only kiosk in production
    frame: isDev,             // Keep frame in dev for testing
    resizable: isDev,         // Allow resize in dev
    movable: isDev,           // Allow move in dev
    minimizable: isDev,       // Allow minimize in dev
    maximizable: isDev,       // Allow maximize in dev
    closable: true,           // ALWAYS CLOSABLE - important!
    alwaysOnTop: !isDev,      // Only on top in production
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      devTools: true           // Always allow DevTools as escape hatch
    },
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://./index.html');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!isDev) {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
    }
  });

  // Don't prevent closing!
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Block navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://') && !url.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  // Register the protocol handler
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.replace('app://', '');
    const filePath = path.normalize(`${__dirname}/${url}`);
    callback({ path: filePath });
  });

  createWindow();

  // Register shortcuts AFTER window is created and shown
  setTimeout(() => {
    // Emergency exit - Multiple shortcuts for redundancy
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      console.log('EXIT SHORTCUT TRIGGERED');
      app.quit();
    });

    // Alternative exit shortcut
    globalShortcut.register('CommandOrControl+Alt+X', () => {
      console.log('ALTERNATIVE EXIT TRIGGERED');
      app.quit();
    });

    // Another alternative
    globalShortcut.register('CommandOrControl+Shift+Escape', () => {
      console.log('ESCAPE EXIT TRIGGERED');
      app.quit();
    });

    // DevTools toggle
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    });

    // Reload
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      if (mainWindow) {
        mainWindow.reload();
      }
    });

    console.log('✅ Emergency shortcuts registered:');
    console.log('   Cmd+Shift+Q - Exit');
    console.log('   Cmd+Alt+X - Exit (alternative)');
    console.log('   Cmd+Shift+Escape - Exit (alternative)');
    console.log('   Cmd+Shift+D - DevTools');
    console.log('   Cmd+Shift+R - Reload');
  }, 1000); // Wait 1 second after window is ready
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});