import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './DownloadPage.css';

const API_URL = (() => {
  if (window.electronAPI !== undefined || window.location.protocol === 'file:') {
    return 'http://13.60.25.12';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'http://13.60.25.12';
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:3001';
})();

function DownloadPage() {
  const { imageId } = useParams();
  const [searchParams] = useSearchParams();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get image URL from query params or construct from imageId
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setImageUrl(urlParam);
      setLoading(false);
    } else if (imageId) {
      setImageUrl(`${API_URL}/generated/${imageId}`);
      setLoading(false);
    } else {
      setError('No image found');
      setLoading(false);
    }
  }, [imageId, searchParams]);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marathon-photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download image. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="download-page">
        <div className="download-loading">
          <div className="loader"></div>
          <p>Loading your photo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="download-page">
        <div className="download-error">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="download-page">
      <div className="download-container">
        <div className="success-badge">
          <div className="success-checkmark">✓</div>
        </div>

        <h1 className="download-title">Your AI Photo is Ready!</h1>
        <p className="download-subtitle">Click the button below to download your image.</p>

        <div className="image-preview-card">
          <img 
            src={imageUrl} 
            alt="Your AI generated marathon photo" 
            className="preview-image-download"
            onError={(e) => {
              e.target.src = '/placeholder-image.jpg';
              setError('Failed to load image');
            }}
          />
          
          <div className="image-info">
            <span className="info-badge">
              <span className="icon">📷</span> High Resolution
            </span>
            <span className="info-badge">
              <span className="icon">🤖</span> AI Generated
            </span>
            <span className="info-badge">
              <span className="icon">⏱️</span> Generated just now
            </span>
          </div>
        </div>

        <button onClick={handleDownload} className="btn-download-primary">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 13L6 9H8V3H12V9H14L10 13Z" fill="white"/>
            <path d="M17 15V17H3V15H1V17C1 18.1 1.9 19 3 19H17C18.1 19 19 18.1 19 17V15H17Z" fill="white"/>
          </svg>
          Download Image
        </button>

        <div className="download-footer">
          <p className="footer-text">
            🏃 <strong>TCS Amsterdam Marathon 2025</strong>
          </p>
          <p className="footer-subtext">
            Share your photo on social media with <strong>#AmsterdamMarathon2025</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

export default DownloadPage;