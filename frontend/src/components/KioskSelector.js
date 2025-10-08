import React from 'react';
import './KioskSelector.css';

function KioskSelector({ onSelect }) {
  const kiosks = [
    { 
      id: 'kiosk-1', 
      name: 'Entrance Booth',
      location: 'Main Entrance',
      icon: '🚪',
      color: '#4E84C4'
    },
    { 
      id: 'kiosk-2', 
      name: 'Center Booth',
      location: 'Event Center',
      icon: '🏛️',
      color: '#45a049'
    },
    { 
      id: 'kiosk-3', 
      name: 'VIP Booth',
      location: 'VIP Area',
      icon: '⭐',
      color: '#FFA726'
    },
    { 
      id: 'kiosk-4', 
      name: 'Exit Booth',
      location: 'Main Exit',
      icon: '🚶',
      color: '#EF5350'
    }
  ];

  const handleSelect = (kioskId) => {
    // Save to localStorage directly (renderer has access)
    localStorage.setItem('kioskId', kioskId);
    
    // Also call electronAPI if available (but not required)
    if (window.electronAPI && typeof window.electronAPI.setKioskId === 'function') {
      window.electronAPI.setKioskId(kioskId);
    }
    
    onSelect(kioskId);
  };

  return (
    <div className="kiosk-selector">
      <h2>Select Kiosk Station</h2>
      <p className="subtitle">Choose which kiosk this device will operate as</p>
      
      <div className="kiosk-grid">
        {kiosks.map(kiosk => (
          <button
            key={kiosk.id}
            className="kiosk-card"
            onClick={() => handleSelect(kiosk.id)}
            style={{ borderColor: kiosk.color }}
          >
            <div className="kiosk-icon" style={{ backgroundColor: kiosk.color }}>
              {kiosk.icon}
            </div>
            <h3>{kiosk.name}</h3>
            <p className="kiosk-location">{kiosk.location}</p>
            <span className="kiosk-id-label">{kiosk.id}</span>
          </button>
        ))}
      </div>
      
      <div className="kiosk-info">
        <p>💡 This selection determines queue management and monitoring for this device</p>
      </div>
    </div>
  );
}

export default KioskSelector;