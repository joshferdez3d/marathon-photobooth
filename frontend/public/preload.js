const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  // Kiosk management
  setKioskId: (id) => {
    localStorage.setItem('kioskId', id);
  },
  
  getKioskId: () => {
    return localStorage.getItem('kioskId') || 'kiosk-1';
  },
  
  // System info
  getSystemInfo: () => ({
    platform: process.platform,
    version: process.versions.electron,
    node: process.versions.node
  }),
  
  // IPC communication (if needed in future)
  send: (channel, data) => {
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});