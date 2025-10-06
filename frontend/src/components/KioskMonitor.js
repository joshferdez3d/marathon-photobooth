import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './KioskMonitor.css';

const API_URL = (() => {
  if (window.electronAPI !== undefined || window.location.protocol === 'file:') {
    return 'http://13.60.25.12';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'http://13.60.25.12';
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:3001';
})();
function KioskMonitor({ kioskId }) {
  const [monitorData, setMonitorData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMonitorData = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/monitor`);
        setMonitorData(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch monitor data');
        console.error('Monitor error:', err);
      }
    };

    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (error) return <div className="monitor-error">{error}</div>;
  if (!monitorData) return <div className="monitor-loading">Loading monitor...</div>;

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="kiosk-monitor">
      <button 
        className="monitor-close" 
        onClick={() => window.location.reload()}
      >
        ✕
      </button>
      
      <h2>System Monitor - {kioskId}</h2>
      
      <div className="monitor-stats">
        <div className="stat-group">
          <h3>Queue Status</h3>
          <p>Queue Size: {monitorData.queueSize}</p>
          <p>Processing: {monitorData.queuePending}</p>
        </div>
        
        <div className="stat-group">
          <h3>Server Status</h3>
          <p>Uptime: {formatUptime(monitorData.serverUptime)}</p>
          <p>Memory: {formatMemory(monitorData.memoryUsage.heapUsed)}</p>
        </div>
      </div>
      
      <div className="kiosk-stats">
        <h3>Kiosk Statistics</h3>
        <table>
          <thead>
            <tr>
              <th>Kiosk</th>
              <th>Total</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Rate</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(monitorData.kiosks).map(([id, stats]) => (
              <tr key={id} className={id === kioskId ? 'current-kiosk' : ''}>
                <td>{id}</td>
                <td>{stats.total}</td>
                <td>{stats.completed}</td>
                <td>{stats.failed}</td>
                <td>{stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(0)}%` : '-'}</td>
                <td>{stats.lastActive ? new Date(stats.lastActive).toLocaleTimeString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="recent-sessions">
        <h3>Recent Sessions</h3>
        <div className="session-list">
          {monitorData.recentSessions.slice(0, 10).map((session) => (
            <div key={session.id} className={`session-item session-${session.status}`}>
              <span>{session.kioskId}</span>
              <span>{session.status}</span>
              <span>{new Date(session.startTime).toLocaleTimeString()}</span>
              {session.duration && <span>{(session.duration / 1000).toFixed(1)}s</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default KioskMonitor;