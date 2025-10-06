import React from 'react';
import './WelcomeScreen.css';

function WelcomeScreen({ onStart }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <div className="camera-icon">📷</div>
      </div>
      
      <h1 className="welcome-title">
        Welcome to the <span className="brand-text">TCS Amsterdam Marathon</span> AI Photobooth
      </h1>
      
      <p className="welcome-description">
        Click start to begin your experience and create stunning AI-generated photos with our advanced technology
      </p>
      
      <button className="btn-start" onClick={onStart}>
        Start Experience →
      </button>
      
      <div className="welcome-features">
        <div className="feature">
          <div className="feature-icon">🎨</div>
          <h4>Multiple Themes</h4>
          <p>Choose from various creative themes</p>
        </div>
        <div className="feature">
          <div className="feature-icon">✨</div>
          <h4>AI Powered</h4>
          <p>Advanced AI image generation</p>
        </div>
        <div className="feature">
          <div className="feature-icon">📥</div>
          <h4>Easy Download</h4>
          <p>QR code and email options</p>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;