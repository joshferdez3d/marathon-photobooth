// Kiosk configuration
const KIOSK_CONFIG = {
  // Get kiosk ID from environment variable, URL parameter, or localStorage
  kioskId: (() => {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const urlKiosk = urlParams.get('kiosk');
    if (urlKiosk) {
      localStorage.setItem('kioskId', urlKiosk);
      return urlKiosk;
    }
    
    // Check environment variable
    if (process.env.REACT_APP_KIOSK_ID) {
      return process.env.REACT_APP_KIOSK_ID;
    }
    
    // Check localStorage
    const stored = localStorage.getItem('kioskId');
    if (stored) return stored;
    
    // Default
    return 'kiosk-1';
  })(),
  
  // Kiosk-specific settings
  settings: {
    'kiosk-1': { 
      name: 'Entrance Booth', 
      timeout: 120000,
      location: 'Main Entrance'
    },
    'kiosk-2': { 
      name: 'Center Booth', 
      timeout: 120000,
      location: 'Event Center'
    },
    'kiosk-3': { 
      name: 'VIP Booth', 
      timeout: 180000,
      location: 'VIP Area'
    },
    'kiosk-4': { 
      name: 'Exit Booth', 
      timeout: 120000,
      location: 'Main Exit'
    }
  },
  
  // Auto-reset after inactivity (1 minute)
  inactivityTimeout: 60000,
  
  // Prevent right-click
  disableContextMenu: true,
  
  // Full screen mode
  autoFullscreen: true,
  
  // Debug mode (shows kiosk info)
  debug: process.env.NODE_ENV === 'development'
};

// Apply kiosk settings
if (KIOSK_CONFIG.disableContextMenu) {
  document.addEventListener('contextmenu', e => e.preventDefault());
}

// Request fullscreen on first interaction
if (KIOSK_CONFIG.autoFullscreen) {
  document.addEventListener('click', () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Fullscreen request failed:', err);
      });
    }
  }, { once: true });
}

export default KIOSK_CONFIG;