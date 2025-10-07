import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import WelcomeScreen from './components/WelcomeScreen';
import KioskSelector from './components/KioskSelector';
import BackgroundSelector from './components/BackgroundSelector';
import GenderSelector from './components/GenderSelector';
import CameraCapture from './components/CameraCapture';
import ResultDisplay from './components/ResultDisplay';
import KioskMonitor from './components/KioskMonitor';
import axios from 'axios';

const isElectron = window.electronAPI !== undefined;

const getApiUrl = () => {
  if (window.electronAPI !== undefined || 
      window.location.protocol === 'file:' || 
      process.env.NODE_ENV === 'production') {
    return 'http://13.60.25.12';
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

function App() {
  const savedKioskId = localStorage.getItem('kioskId');
  
  const [currentStep, setCurrentStep] = useState(savedKioskId ? 1 : 0);
  const [kioskId, setKioskId] = useState(savedKioskId || null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [queuePosition, setQueuePosition] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  const inactivityTimer = useRef(null);
  const lastActivityTime = useRef(Date.now());

  const KIOSK_SETTINGS = {
    'kiosk-1': { name: 'Entrance Booth', timeout: 120000, location: 'Main Entrance' },
    'kiosk-2': { name: 'Center Booth', timeout: 120000, location: 'Event Center' },
    'kiosk-3': { name: 'VIP Booth', timeout: 180000, location: 'VIP Area' },
    'kiosk-4': { name: 'Exit Booth', timeout: 120000, location: 'Main Exit' }
  };

  const kioskInfo = kioskId ? KIOSK_SETTINGS[kioskId] : null;

  // Background image style - only apply when NOT on camera page (step 4)
  const appBackgroundStyle = currentStep !== 4 ? {
    backgroundImage: `url(${process.env.PUBLIC_URL}/Background.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed'
  } : {};

  const handleKioskSelect = (selectedKioskId) => {
    setKioskId(selectedKioskId);
    localStorage.setItem('kioskId', selectedKioskId);
    setCurrentStep(1);
  };

  const resetToStart = useCallback(() => {
    console.log(`[${kioskId}] Resetting due to inactivity`);
    setCurrentStep(1);
    setSelectedBackground(null);
    setSelectedGender(null);
    setCapturedImage(null);
    setGeneratedImage(null);
    setError(null);
    setQueuePosition(null);
    setLoadingProgress(0);
  }, [kioskId]);

  const resetInactivityTimer = useCallback(() => {
    lastActivityTime.current = Date.now();
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    if (currentStep > 1 && !isLoading) {
      inactivityTimer.current = setTimeout(() => {
        resetToStart();
      }, 90000);
    }
  }, [currentStep, isLoading, resetToStart]);

  useEffect(() => {
    if (!kioskId) return;
    
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

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setShowMonitor(!showMonitor);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        localStorage.removeItem('kioskId');
        setKioskId(null);
        setCurrentStep(0);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showMonitor]);

  const handleWelcomeStart = () => {
    setCurrentStep(2);
    resetInactivityTimer();
  };

  const handleGenderSelect = (gender) => {
    setSelectedGender(gender);
    setCurrentStep(3);
    resetInactivityTimer();
  };

  const handleBackgroundSelect = (background) => {
    setSelectedBackground(background);
    setCurrentStep(4);
    resetInactivityTimer();
  };

  const handleImageCapture = (imageData) => {
    setCapturedImage(imageData);
    setCurrentStep(5);
    resetInactivityTimer();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCurrentStep(4);
    resetInactivityTimer();
  };

  const getImageUrl = (imageUrl) => {
    if (imageUrl?.startsWith('http://') || imageUrl?.startsWith('https://')) {
      return imageUrl;
    }
    return `${API_URL}${imageUrl}`;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setQueuePosition(null);
    setLoadingProgress(0);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 2000);

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

      clearInterval(progressInterval);
      setLoadingProgress(100);

      if (response.data.success) {
        setTimeout(() => {
          setGeneratedImage(getImageUrl(response.data.imageUrl));
          setCurrentStep(6);
          console.log(`[${kioskId}] Generated in ${response.data.processingTime}ms`);
        }, 500);
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }
    } catch (err) {
      clearInterval(progressInterval);
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
    setCurrentStep(1);
    setSelectedBackground(null);
    setSelectedGender(null);
    setCapturedImage(null);
    setGeneratedImage(null);
    setError(null);
    setQueuePosition(null);
    setLoadingProgress(0);
    resetInactivityTimer();
  };

  return (
    <div className="App" data-kiosk={kioskId} style={appBackgroundStyle}>
      {showMonitor && kioskId && <KioskMonitor kioskId={kioskId} />}
      
      {kioskId && process.env.NODE_ENV === 'development' && (
        <div className="kiosk-debug">
          Kiosk: {kioskId} | Location: {kioskInfo?.location}
          <br />
          <small>Ctrl+Shift+K: reconfigure | Ctrl+Shift+M: monitor</small>
        </div>
      )}

      <main className="App-main">
        {currentStep === 0 && (
          <KioskSelector onSelect={handleKioskSelect} />
        )}

        {currentStep === 1 && (
          <WelcomeScreen onStart={handleWelcomeStart} />
        )}

        {currentStep === 2 && (
          <GenderSelector onSelect={handleGenderSelect} />
        )}

        {currentStep === 3 && (
          <BackgroundSelector onSelect={handleBackgroundSelect} />
        )}

        {currentStep === 4 && (
          <CameraCapture 
            onCapture={handleImageCapture}
            onBack={() => {
              setCurrentStep(3);
              resetInactivityTimer();
            }}
          />
        )}

        {currentStep === 5 && (
          <div className="preview-section">
            <h3>Here's your photo!</h3>
            <p className="subtitle">Review your captured image and decide if you'd like to proceed or retake</p>
            <img src={capturedImage} alt="Your selfie" className="preview-image" />
            <div className="button-group">
              <button onClick={handleRetake} className="btn btn-secondary">
                🔄 Retake Photo
              </button>
              <button 
                onClick={handleGenerate} 
                className="btn btn-primary btn-proceed"
                disabled={isLoading}
              >
                {isLoading ? 'Generating... ⏳' : 'Proceed →'}
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

        {currentStep === 6 && generatedImage && (
          <ResultDisplay 
            imageUrl={generatedImage} 
            onStartOver={handleStartOver}
            kioskId={kioskId}
          />
        )}

        {isLoading && (
          <div className="loading-overlay-new">
            <div className="loading-content">
              <div className="loading-spinner-container">
                <div className="loading-spinner-outer"></div>
                <div className="loading-spinner-middle"></div>
                <div className="loading-spinner-inner"></div>
                <div className="loading-icon"></div>
              </div>
              
              <h2 className="loading-title">
                <span className="loading-highlight">AI Magic</span> in Progress
              </h2>
              <p className="loading-subtitle">
                Your image is being generated. Please wait 15-20 seconds...
              </p>
              <p className="loading-description">
                Our advanced AI is crafting your personalized photo with stunning detail and creativity
              </p>
              
              <div className="loading-progress-bar">
                <div 
                  className="loading-progress-fill" 
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <p className="loading-progress-text">Processing... {loadingProgress}%</p>
              
              <div className="loading-stages">
                <div className={`stage ${loadingProgress >= 0 ? 'active' : ''} ${loadingProgress >= 25 ? 'completed' : ''}`}>
                  <div className="stage-icon">📸</div>
                  <p>Photo Captured</p>
                </div>
                <div className={`stage ${loadingProgress >= 25 ? 'active' : ''} ${loadingProgress >= 50 ? 'completed' : ''}`}>
                  <div className="stage-icon">🎨</div>
                  <p>Theme Applied</p>
                </div>
                <div className={`stage ${loadingProgress >= 50 ? 'active' : ''} ${loadingProgress >= 75 ? 'completed' : ''}`}>
                  <div className="stage-icon">⚙️</div>
                  <p>AI Processing</p>
                </div>
                <div className={`stage ${loadingProgress >= 75 ? 'active' : ''} ${loadingProgress >= 100 ? 'completed' : ''}`}>
                  <div className="stage-icon">✅</div>
                  <p>Finalizing</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {currentStep > 1 && !isLoading && (
        <div className="inactivity-timer" style={{
          display: Date.now() - lastActivityTime.current > 45000 ? 'block' : 'none'
        }}>
          Session will reset in {Math.ceil((90000 - (Date.now() - lastActivityTime.current)) / 1000)} seconds
        </div>
      )}
    </div>
  );
}

export default App;