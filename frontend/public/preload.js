const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  // Kiosk management - fixed to work without localStorage in preload
  setKioskId: (id) => {
    // Store in memory, not localStorage (which isn't available in preload)
    return id;
  },
  
  getKioskId: () => {
    // Return null, let the renderer handle localStorage
    return null;
  },
  
  // System info
  getSystemInfo: () => ({
    platform: process.platform,
    version: process.versions.electron,
    node: process.versions.node
  })
});