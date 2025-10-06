import React, { useState, useEffect } from 'react';
import './BackgroundSelector.css';
import axios from 'axios';

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

function BackgroundSelector({ onSelect }) {
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categoryConfig = {
    'amsterdam750': {
      label: 'Amsterdam 750 Styles',
      color: '#5B8CC5'
    },
    'tcs50': {
      label: 'TCS Amsterdam Marathon - 50 Years Styles',
      color: '#FF6B35'
    },
    'futureofrunning': {
      label: 'Future of Running Styles',
      color: '#E8E8E8'
    }
  };

  useEffect(() => {
    const fetchBackgrounds = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/backgrounds`);
        setCategories(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch backgrounds:', err);
        setError('Failed to load backgrounds. Please refresh the page.');
        setLoading(false);
      }
    };

    fetchBackgrounds();
  }, []);

  const handleBackgroundSelect = (background, categoryKey) => {
    onSelect({
      ...background,
      category: categoryKey
    });
  };

  if (loading) {
    return (
      <div className="background-selector-unified">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loader"></div>
          <p style={{ marginTop: '1rem', color: 'white' }}>Loading backgrounds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="background-selector-unified">
        <div className="error-message" style={{ margin: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.9)', borderRadius: '8px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!categories) {
    return (
      <div className="background-selector-unified">
        <div className="error-message">No backgrounds available</div>
      </div>
    );
  }

  return (
    <div className="background-selector-unified">
      <div className="selector-header-unified">
        <h2 className="selector-title-unified">
          Choose your <span className="highlight-text">theme and style</span>
        </h2>
        <p className="selector-subtitle-unified">
          Select a theme and style that best represent your vision for the AI-generated photo
        </p>
      </div>

      <div className="category-grid-layout">
        <div className="category-labels">
          {Object.entries(categoryConfig).map(([key, config]) => (
            <div
              key={key}
              className="category-label"
              style={{ 
                backgroundColor: config.color,
                color: key === 'futureofrunning' ? '#333' : '#fff'
              }}
            >
              {config.label}
            </div>
          ))}
        </div>

        <div className="backgrounds-unified-grid">
          {Object.entries(categoryConfig).map(([categoryKey, config]) => {
            const category = categories[categoryKey];
            if (!category || !category.backgrounds) return null;

            return (
              <div key={categoryKey} className="category-row">
                {category.backgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    className="background-unified-card"
                    onClick={() => handleBackgroundSelect(bg, categoryKey)}
                  >
                    <div className="background-unified-image">
                      <img
                        src={`${API_URL}${bg.thumbnail}`}
                        alt={bg.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `${API_URL}/backgrounds/placeholder.jpg`;
                        }}
                      />
                      <div className="background-unified-overlay">
                        <div className="checkmark-unified">✓</div>
                      </div>
                    </div>
                    <div className="background-unified-name">
                      <h4>{bg.name}</h4>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default BackgroundSelector;