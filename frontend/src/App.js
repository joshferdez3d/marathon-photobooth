import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import KioskSelector from './components/KioskSelector'; // Add this import
import BackgroundSelector from './components/BackgroundSelector';
import GenderSelector from './components/GenderSelector';
import CameraCapture from './components/CameraCapture';
import ResultDisplay from './components/ResultDisplay';
import KioskMonitor from './components/KioskMonitor';
import axios from 'axios';

const isElectron = window.electronAPI !== undefined;

const getApiUrl = () => {
  // Always use Railway URL for Electron or production
  if (window.electronAPI !== undefined || 
      window.location.protocol === 'file:' || 
      process.env.NODE_ENV === 'production') {
    return 'https://marathon-photobooth-backend-production.up.railway.app';
  }
  
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

function App() {
  // Check if kiosk is already configured
  const savedKioskId = localStorage.getItem('kioskId');
  
  // If kiosk is already set, start at step 1 (background selector)
  // If not set, start at step 0 (kiosk selector)
  const [currentStep, setCurrentStep] = useState(savedKioskId ? 1 : 0);
  const [kioskId, setKioskId] = useState(savedKioskId || null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [queuePosition, setQueuePosition] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  // Inactivity timer
  const inactivityTimer = useRef(null);
  const lastActivityTime = useRef(Date.now());

  // Get kiosk info
  const KIOSK_SETTINGS = {
    'kiosk-1': { name: 'Entrance Booth', timeout: 120000, location: 'Main Entrance' },
    'kiosk-2': { name: 'Center Booth', timeout: 120000, location: 'Event Center' },
    'kiosk-3': { name: 'VIP Booth', timeout: 180000, location: 'VIP Area' },
    'kiosk-4': { name: 'Exit Booth', timeout: 120000, location: 'Main Exit' }
  };

  const kioskInfo = kioskId ? KIOSK_SETTINGS[kioskId] : null;

  // Handle kiosk selection (only happens once at app launch)
  const handleKioskSelect = (selectedKioskId) => {
    setKioskId(selectedKioskId);
    localStorage.setItem('kioskId', selectedKioskId);
    setCurrentStep(1); // Go to background selector
  };

  // Reset to start screen (goes to background selector, NOT kiosk selector)
  const resetToStart = useCallback(() => {
    console.log(`[${kioskId}] Resetting due to inactivity`);
    setCurrentStep(1); // Reset to background selector (step 1), not kiosk selector
    setSelectedBackground(null);
    setSelectedGender(null);
    setCapturedImage(null);
    setGeneratedImage(null);
    setError(null);
    setQueuePosition(null);
  }, [kioskId]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityTime.current = Date.now();
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    // Don't reset if on step 0 (kiosk selection) or step 1 (home) or loading
    if (currentStep > 1 && !isLoading) {
      inactivityTimer.current = setTimeout(() => {
        resetToStart();
      }, 60000); // 60 seconds timeout
    }
  }, [currentStep, isLoading, resetToStart]);

  // Check backend connection
  useEffect(() => {
    if (!kioskId) return; // Don't check connection until kiosk is selected
    
    const checkConnection = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/health`, {
          headers: { 'X-Kiosk-Id': kioskId },
          timeout: 5000
        });
        setConnectionStatus('connected');
        console.log(`Connected to backend: ${API_URL}`);
      } catch (error) {
        console.error('Backend connection failed:', error);
        setConnectionStatus('error');
        setError(`Cannot connect to server at ${API_URL}. Please check settings.`);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [kioskId]);

  // Setup inactivity tracking
  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'keypress'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });
    
    resetInactivityTimer();
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [resetInactivityTimer]);

  // Toggle monitor with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setShowMonitor(!showMonitor);
      }
      // Add shortcut to reset kiosk selection (for testing/reconfiguration)
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        localStorage.removeItem('kioskId');
        setKioskId(null);
        setCurrentStep(0);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showMonitor]);

  const handleBackgroundSelect = (background) => {
    setSelectedBackground(background);
    setCurrentStep(2);
    resetInactivityTimer();
  };

  const handleGenderSelect = (gender) => {
    setSelectedGender(gender);
    setCurrentStep(3);
    resetInactivityTimer();
  };

  const handleImageCapture = (imageData) => {
    setCapturedImage(imageData);
    setCurrentStep(4);
    resetInactivityTimer();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCurrentStep(3);
    resetInactivityTimer();
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setQueuePosition(null);

    try {
      const base64Response = await fetch(capturedImage);
      const blob = await base64Response.blob();

      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      formData.append('backgroundId', selectedBackground.id);
      formData.append('gender', selectedGender);

      const response = await axios.post(`${API_URL}/api/generate`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'X-Kiosk-Id': kioskId
        },
        timeout: kioskInfo?.timeout || 120000
      });

      if (response.data.success) {
        setGeneratedImage(`${API_URL}${response.data.imageUrl}`);
        setCurrentStep(5);
        console.log(`[${kioskId}] Generated in ${response.data.processingTime}ms`);
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }
    } catch (err) {
      console.error(`[${kioskId}] Generation error:`, err);
      
      if (err.response?.status === 503) {
        setError('The system is busy. Please wait a moment and try again.');
        setQueuePosition(err.response?.data?.queueSize);
      } else if (err.response?.status === 429) {
        setError('Please wait a moment before trying again.');
      } else {
        setError(err.message || 'Failed to generate image. Please try again.');
      }
    } finally {
      setIsLoading(false);
      resetInactivityTimer();
    }
  };

  const handleStartOver = () => {
    // Go back to background selector (step 1), NOT kiosk selector
    setCurrentStep(1);
    setSelectedBackground(null);
    setSelectedGender(null);
    setCapturedImage(null);
    setGeneratedImage(null);
    setError(null);
    setQueuePosition(null);
    resetInactivityTimer();
  };

  return (
    <div className="App" data-kiosk={kioskId}>
      {showMonitor && kioskId && <KioskMonitor kioskId={kioskId} />}
      
      <header className="App-header">
        <h1>🏃 Amsterdam Marathon 2025</h1>
        <h2>
          AI Photo Booth
          {kioskInfo && ` - ${kioskInfo.name}`}
        </h2>
        {kioskId && process.env.NODE_ENV === 'development' && (
          <div className="kiosk-debug">
            Kiosk: {kioskId} | Location: {kioskInfo?.location}
            <br />
            <small>Press Ctrl+Shift+K to reconfigure kiosk</small>
          </div>
        )}
      </header>

      <main className="App-main">
        {currentStep === 0 && (
          <KioskSelector onSelect={handleKioskSelect} />
        )}

        {currentStep === 1 && (
          <BackgroundSelector onSelect={handleBackgroundSelect} />
        )}

        {currentStep === 2 && (
          <GenderSelector onSelect={handleGenderSelect} />
        )}

        {currentStep === 3 && (
          <CameraCapture onCapture={handleImageCapture} />
        )}

        {currentStep === 4 && (
          <div className="preview-section">
            <h3>Review Your Photo</h3>
            <img src={capturedImage} alt="Your selfie" className="preview-image" />
            <div className="button-group">
              <button onClick={handleRetake} className="btn btn-secondary">
                📸 Retake Photo
              </button>
              <button 
                onClick={handleGenerate} 
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Generating... ⏳' : '✨ Generate Marathon Photo'}
              </button>
            </div>
            {error && (
              <div className="error-message">
                {error}
                {queuePosition && <p>Queue position: {queuePosition}</p>}
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && generatedImage && (
          <ResultDisplay 
            imageUrl={generatedImage} 
            onStartOver={handleStartOver}
            kioskId={kioskId}
          />
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="loader"></div>
            <p>Creating your marathon moment...</p>
            <p className="loading-subtitle">This may take 30-60 seconds</p>
            {queuePosition && <p>Position in queue: {queuePosition}</p>}
          </div>
        )}
      </main>

      {/* Inactivity warning - only show after step 1 */}
      {currentStep > 1 && !isLoading && (
        <div className="inactivity-timer" style={{
          display: Date.now() - lastActivityTime.current > 45000 ? 'block' : 'none'
        }}>
          Session will reset in {Math.ceil((60000 - (Date.now() - lastActivityTime.current)) / 1000)} seconds
        </div>
      )}
    </div>
  );
}

export default App;