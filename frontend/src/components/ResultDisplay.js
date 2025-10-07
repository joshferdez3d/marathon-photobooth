import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import './ResultDisplay.css';

function ResultDisplay({ imageUrl, onStartOver }) {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const API_URL = (() => {
    // For Electron production build
    if (window.electronAPI !== undefined || window.location.protocol === 'file:') {
      return 'http://13.60.25.12';  // Your EC2 public IP
    }
    
    // For production web build
    if (process.env.NODE_ENV === 'production') {
      return 'http://13.60.25.12';  // Your EC2 public IP
    }
    
    return process.env.REACT_APP_API_URL || 'http://localhost:3001';
  })();

  useEffect(() => {
    const generateQR = async () => {
      try {
        // Point to the download.html page on your server with the S3 URL
        const downloadUrl = `${API_URL}/download.html?url=${encodeURIComponent(imageUrl)}`;
        
        const qr = await QRCode.toDataURL(downloadUrl, {
          width: 180,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(qr);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };
    
    if (imageUrl) {
      generateQR();
    }
  }, [imageUrl]);

  const handleEmailShare = async () => {
    if (!consent) {
      alert('Please accept the privacy policy to send the email');
      return;
    }
    
    // TODO: Implement email sharing logic with backend
    console.log('Sending email to:', email);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="result-display-new">
      <div className="result-header">
        <div className="success-icon">✓</div>
        <h2>Your <span className="ai-highlight">AI photo</span> is ready!</h2>
      </div>

      <div className="result-content">
        <div className="result-left">
          <div className="result-image-card">
            <img src={imageUrl} alt="Generated marathon photo" className="result-image-new" />
            <div className="result-badges">
              <span className="badge-generated">🤖 Generated with AI</span>
              <span className="badge-quality">⭐ Premium Quality</span>
            </div>
          </div>
          <button onClick={onStartOver} className="btn-new-photo">
            📸 Take New Photo
          </button>
        </div>

        <div className="result-right">
          <div className="download-card">
            <h3>Quick Download</h3>
            <div className="qr-code-container">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
              ) : (
                <div className="qr-placeholder">Loading...</div>
              )}
            </div>
            <p className="download-instruction">Scan with your phone to download</p>
            <p className="download-features">📱 High resolution • Instant download</p>
          </div>

          <div className="email-card">
            <h3>📧 Email Option</h3>
            <p className="email-instruction">Enter your email address</p>
            <input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="email-input-new"
            />
            <div className="consent-checkbox">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <label htmlFor="consent">
                I consent to receive my photo by email and agree to TCS's privacy policy for processing my personal data.
              </label>
            </div>
            <button 
              onClick={handleEmailShare} 
              className="btn-send-email"
              disabled={!email || !consent || emailSent}
            >
              {emailSent ? '✅ Sent!' : '✉️ Send Mail'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResultDisplay;