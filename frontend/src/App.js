import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import BackgroundSelector from './components/BackgroundSelector';
import GenderSelector from './components/GenderSelector';
import CameraCapture from './components/CameraCapture';
import ResultDisplay from './components/ResultDisplay';
import KioskMonitor from './components/KioskMonitor'; // New component
import axios from 'axios';
import KIOSK_CONFIG from './config/kiosk';
const isElectron = window.electronAPI !== undefined;


const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Check if we have a saved API URL in localStorage (for kiosk configuration)
  const savedUrl = localStorage.getItem('apiUrl');
  if (savedUrl) {
    return savedUrl;
  }
  
  // Default URLs
  if (process.env.NODE_ENV === 'production' || isElectron) {
    return 'https://marathon-photobooth-backend.railway.app'; // Replace with your Railway URL
  }
  
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

function App() {
  const [currentStep, setCurrentStep] = useState(1);
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
  const kioskInfo = KIOSK_CONFIG.settings[KIOSK_CONFIG.kioskId] || KIOSK_CONFIG.settings['kiosk-1'];

  // Reset to start screen
  const resetToStart = useCallback(() => {
    console.log(`[${KIOSK_CONFIG.kioskId}] Resetting due to inactivity`);
    setCurrentStep(1);
    setSelectedBackground(null);
    setSelectedGender(null);
    setCapturedImage(null);
    setGeneratedImage(null);
    setError(null);
    setQueuePosition(null);
  }, []);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityTime.current = Date.now();
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    // Don't reset if on step 1 (start screen) or loading
    if (currentStep > 1 && !isLoading) {
      inactivityTimer.current = setTimeout(() => {
        resetToStart();
      }, KIOSK_CONFIG.inactivityTimeout);
    }
  }, [currentStep, isLoading, resetToStart]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/health`, {
          headers: { 'X-Kiosk-Id': KIOSK_CONFIG.kioskId },
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
  }, []);

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

  // Check kiosk health periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await axios.get(`${API_URL}/api/health`, {
          headers: { 'X-Kiosk-Id': KIOSK_CONFIG.kioskId }
        });
      } catch (error) {
        console.error('Health check failed:', error);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Toggle monitor with keyboard shortcut (Ctrl+Shift+M)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setShowMonitor(!showMonitor);
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
      // Convert base64 to blob
      const base64Response = await fetch(capturedImage);
      const blob = await base64Response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      formData.append('backgroundId', selectedBackground.id);
      formData.append('gender', selectedGender);

      // Send to backend with kiosk ID
      const response = await axios.post(`${API_URL}/api/generate`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'X-Kiosk-Id': KIOSK_CONFIG.kioskId
        },
        timeout: kioskInfo.timeout || 120000
      });

      if (response.data.success) {
        setGeneratedImage(`${API_URL}${response.data.imageUrl}`);
        setCurrentStep(5);
        
        // Log successful generation
        console.log(`[${KIOSK_CONFIG.kioskId}] Generated in ${response.data.processingTime}ms`);
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }
    } catch (err) {
      console.error(`[${KIOSK_CONFIG.kioskId}] Generation error:`, err);
      
      // Check if it's a queue/rate limit error
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
    <div className="App" data-kiosk={KIOSK_CONFIG.kioskId}>
      {showMonitor && <KioskMonitor kioskId={KIOSK_CONFIG.kioskId} />}
      
      <header className="App-header">
        <h1>ðŸƒ Amsterdam Marathon 2025</h1>
        <h2>AI Photo Booth - {kioskInfo.name}</h2>
        {KIOSK_CONFIG.debug && (
          <div className="kiosk-debug">
            Kiosk: {KIOSK_CONFIG.kioskId} | Location: {kioskInfo.location}
          </div>
        )}
      </header>

      <main className="App-main">
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
                ðŸ“¸ Retake Photo
              </button>
              <button 
                onClick={handleGenerate} 
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Generating... â³' : 'âœ¨ Generate Marathon Photo'}
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
            kioskId={KIOSK_CONFIG.kioskId}
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

      {/* Inactivity warning */}
      {currentStep > 1 && !isLoading && (
        <div className="inactivity-timer" style={{
          display: Date.now() - lastActivityTime.current > 45000 ? 'block' : 'none'
        }}>
          Session will reset in {Math.ceil((KIOSK_CONFIG.inactivityTimeout - (Date.now() - lastActivityTime.current)) / 1000)} seconds
        </div>
      )}
    </div>
  );
}

export default App;