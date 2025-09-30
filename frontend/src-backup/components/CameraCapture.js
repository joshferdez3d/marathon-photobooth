import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';

function CameraCapture({ onCapture }) {
  const webcamRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  const [shouldCapture, setShouldCapture] = useState(false);

  // Updated video constraints for full screen
  const videoConstraints = {
    width: { ideal: window.innerWidth },
    height: { ideal: window.innerHeight },
    facingMode: 'user' // Front camera for selfie
  };

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        onCapture(imageSrc);
      }
    }
  }, [onCapture]);

  // Handle capture after countdown
  useEffect(() => {
    if (shouldCapture) {
      capturePhoto();
      setShouldCapture(false);
    }
  }, [shouldCapture, capturePhoto]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer);
          setShouldCapture(true); // Trigger capture in effect
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  return (
    <div className="camera-capture camera-fullscreen">
      <div className="camera-container-fullscreen">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="webcam-fullscreen"
          mirrored={true} // Mirror the video like a selfie camera
          screenshotQuality={0.92} // High quality screenshots
        />
        
        {countdown && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
          </div>
        )}

        <div className="camera-guide">
          <div className="guide-frame"></div>
        </div>

        {/* Header overlay */}
        <div className="camera-header-overlay">
          <h3>Take Your Photo</h3>
          <p>Position yourself in the center and smile!</p>
        </div>

        {/* Button overlay at bottom */}
        <div className="camera-button-overlay">
          <button 
            onClick={startCountdown} 
            className="btn btn-capture-overlay"
            disabled={countdown !== null}
          >
            {countdown !== null ? `${countdown}...` : '📸 Take Photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CameraCapture;