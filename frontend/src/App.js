import React, { useState, useRef } from 'react';
import './App.css';
import BackgroundSelector from './components/BackgroundSelector';
import GenderSelector from './components/GenderSelector';
import CameraCapture from './components/CameraCapture';
import ResultDisplay from './components/ResultDisplay';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleBackgroundSelect = (background) => {
    setSelectedBackground(background);
    setCurrentStep(2);
  };

  const handleGenderSelect = (gender) => {
    setSelectedGender(gender);
    setCurrentStep(3);
  };

  const handleImageCapture = (imageData) => {
    setCapturedImage(imageData);
    setCurrentStep(4);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCurrentStep(3);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Convert base64 to blob
      const base64Response = await fetch(capturedImage);
      const blob = await base64Response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      formData.append('backgroundId', selectedBackground.id);
      formData.append('gender', selectedGender);

      // Send to backend
      const response = await axios.post(`${API_URL}/api/generate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000 // 60 second timeout
      });

      if (response.data.success) {
        setGeneratedImage(`${API_URL}${response.data.imageUrl}`);
        setCurrentStep(5);
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setSelectedBackground(null);
    setSelectedGender(null);
    setCapturedImage(null);
    setGeneratedImage(null);
    setError(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏃 Amsterdam Marathon 2025</h1>
        <h2>AI Photo Booth</h2>
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
            {error && <div className="error-message">{error}</div>}
          </div>
        )}

        {currentStep === 5 && generatedImage && (
          <ResultDisplay 
            imageUrl={generatedImage} 
            onStartOver={handleStartOver}
          />
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="loader"></div>
            <p>Creating your marathon moment...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;