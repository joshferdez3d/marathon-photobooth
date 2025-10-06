const { app, BrowserWindow, Menu, shell, dialog, systemPreferences } = require('electron'); // Add systemPreferences
const path = require('path');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let splashWindow;

// Enable live reload for Electron in development
if (isDev) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

// Add camera permission checker
async function checkCameraPermissions() {
  if (process.platform === 'darwin') { // macOS
    try {
      const status = systemPreferences.getMediaAccessStatus('camera');
      console.log('Camera permission status:', status);
      
      if (status === 'not-determined') {
        const granted = await systemPreferences.askForMediaAccess('camera');
        console.log('Camera permission granted:', granted);
        return granted;
      }
      
      return status === 'granted';
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      return false;
    }
  }
  
  // Windows/Linux usually grant permissions automatically
  return true;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 768,
    fullscreen: !isDev,
    kiosk: !isDev,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev, // Disable web security in dev for easier camera access
      // Add permissions policy
      permissionPolicy: {
        camera: ['self']
      }
    },
    icon: path.join(__dirname, 'icon.ico'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  });

  // Handle permission requests from renderer
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(true); // Allow other permissions
    }
  });

  // Load the app
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready and check camera permissions
  mainWindow.once('ready-to-show', async () => {
    // Check camera permissions before showing
    const hasCameraAccess = await checkCameraPermissions();
    
    if (!hasCameraAccess && process.platform === 'darwin') {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Camera Access Required',
        message: 'Marathon Photo Booth needs camera access to take photos.',
        detail: 'Please grant camera permission:\n\n1. Open System Preferences\n2. Go to Security & Privacy → Privacy\n3. Select Camera\n4. Check "Marathon Photo Booth"\n5. Restart the application',
        buttons: ['OK', 'Open System Preferences']
      }).then((result) => {
        if (result.response === 1) {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera');
        }
      });
    }
    
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
      }
      mainWindow.show();
      
      if (process.platform === 'darwin') {
        app.dock.show();
      }
      mainWindow.focus();
    }, 1500);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3000') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto-updater events
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Create app menu (keep your existing menu code)
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.reloadIgnoringCache();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        },
        {
          label: 'Toggle Kiosk Mode',
          accelerator: 'CmdOrCtrl+Shift+K',
          visible: isDev,
          click: () => {
            mainWindow.setKiosk(!mainWindow.isKiosk());
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          visible: isDev,
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Kiosk',
      submenu: [
        {
          label: 'Reset Kiosk Selection',
          click: () => {
            mainWindow.webContents.executeJavaScript(
              `localStorage.removeItem('kioskId'); window.location.reload();`
            );
          }
        },
        {
          label: 'Set Kiosk ID',
          click: async () => {
            const result = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              buttons: ['Kiosk 1', 'Kiosk 2', 'Kiosk 3', 'Kiosk 4', 'Cancel'],
              defaultId: 0,
              title: 'Select Kiosk ID',
              message: 'Which kiosk is this?'
            });
            
            if (result.response < 4) {
              const kioskId = `kiosk-${result.response + 1}`;
              mainWindow.webContents.executeJavaScript(
                `localStorage.setItem('kioskId', '${kioskId}'); window.location.reload();`
              );
            }
          }
        },
        {
          label: 'Show Monitor',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            mainWindow.webContents.executeJavaScript(
              `document.dispatchEvent(new KeyboardEvent('keydown', {ctrlKey: true, shiftKey: true, key: 'M'}));`
            );
          }
        },
        { type: 'separator' },
        {
          label: 'Check Camera Permission',
          click: async () => {
            const hasCameraAccess = await checkCameraPermissions();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Camera Permission Status',
              message: hasCameraAccess ? 'Camera access is granted' : 'Camera access is denied',
              buttons: ['OK']
            });
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Amsterdam Marathon 2025 - AI Photo Booth',
              detail: 'Version 1.0.0\nPowered by TCS & Gemini AI',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: 'Services', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Hide ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Command+Shift+H', role: 'hideothers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(async () => {
  // Request camera access on app start (macOS)
  if (process.platform === 'darwin') {
    try {
      const cameraAccess = await systemPreferences.askForMediaAccess('camera');
      console.log('Camera access granted:', cameraAccess);
    } catch (error) {
      console.error('Failed to request camera access:', error);
    }
  }
  
  createSplashWindow();
  createWindow();
  createMenu();

  // Handle app activation (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. It will be downloaded in the background.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});