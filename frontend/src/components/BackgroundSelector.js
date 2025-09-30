import React, { useState, useEffect, useRef } from 'react';
import './BackgroundSelector.css';
import KIOSK_CONFIG from '../config/kiosk';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BackgroundSelector({ onSelect }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollContainerRef = useRef(null);
  const categoryScrollRef = useRef(null);

  useEffect(() => {
    const fetchBackgrounds = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/backgrounds`);
        
        // Transform the API response to match our frontend structure
        const transformedCategories = {
          'amsterdam750': {
            title: 'Amsterdam 750',
            subtitle: 'Historic Journey Through Time',
            description: 'Travel back to Amsterdam\'s Golden Age',
            icon: '🏛️',
            color: '#8B7355',
            backgrounds: response.data.amsterdam750?.backgrounds || []
          },
          'futureofrunning': {
            title: 'Future of Running',
            subtitle: '2050 Marathon Experience',
            description: 'Race through tomorrow\'s Amsterdam',
            icon: '🚀',
            color: '#00B4D8',
            backgrounds: response.data.futureofrunning?.backgrounds || []
          },
          'tcs50': {
            title: 'TCS50',
            subtitle: '50 Years of Marathon Excellence',
            description: 'Celebrating marathon heritage',
            icon: '🏃',
            color: '#4E84C4',
            backgrounds: response.data.tcs50?.backgrounds || []
          }
        };
        
        setCategories(transformedCategories);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch backgrounds:', err);
        setError('Failed to load backgrounds. Please refresh the page.');
        setLoading(false);
      }
    };

    fetchBackgrounds();
  }, []);

  const handleCategorySelect = (categoryKey) => {
    setSelectedCategory(categoryKey);
  };

  const handleBackgroundSelect = (background) => {
    onSelect({
      ...background,
      category: selectedCategory
    });
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  // Scroll handlers for background navigation
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: -400,
        behavior: 'smooth'
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: 400,
        behavior: 'smooth'
      });
    }
  };

  // Scroll handlers for category navigation
  const scrollCategoryLeft = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: -400,
        behavior: 'smooth'
      });
    }
  };

  const scrollCategoryRight = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: 400,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="background-selector">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loader"></div>
          <p style={{ marginTop: '1rem', color: 'white' }}>Loading backgrounds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="background-selector">
        <div className="error-message" style={{ margin: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.9)', borderRadius: '8px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!categories) {
    return (
      <div className="background-selector">
        <div className="error-message">No backgrounds available</div>
      </div>
    );
  }

  // Category selection view with horizontal scroll
  if (!selectedCategory) {
    return (
      <div className="category-selector">
        <h2>Choose Your Marathon Era</h2>
        <p className="subtitle">Select a theme for your marathon journey</p>
        
        {/* Horizontal scrolling container for categories */}
        <div className="horizontal-scroll-wrapper">
          <button className="scroll-arrow scroll-arrow-left" onClick={scrollCategoryLeft}>
            ‹
          </button>
          
          <div className="category-horizontal-scroll" ref={categoryScrollRef}>
            <div className="category-row">
              {Object.entries(categories).map(([key, category]) => (
                <div
                  key={key}
                  className="category-card-horizontal"
                  onClick={() => handleCategorySelect(key)}
                  style={{ borderColor: category.color }}
                >
                  <div className="category-icon" style={{ backgroundColor: category.color }}>
                    {category.icon}
                  </div>
                  <div className="category-content">
                    <h3>{category.title}</h3>
                    <h4>{category.subtitle}</h4>
                    <p>{category.description}</p>
                    <div className="category-preview">
                      <div className="preview-count">
                        {category.backgrounds.length} backgrounds
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <button className="scroll-arrow scroll-arrow-right" onClick={scrollCategoryRight}>
            ›
          </button>
        </div>
      </div>
    );
  }

  // Background selection view with horizontal scroll
  const currentCategory = categories[selectedCategory];
  
  if (!currentCategory || !currentCategory.backgrounds || currentCategory.backgrounds.length === 0) {
    return (
      <div className="background-selector">
        <button className="back-button" onClick={handleBack}>
          ← Back to Categories
        </button>
        <div className="error-message">No backgrounds available in this category</div>
      </div>
    );
  }
  
  return (
    <div className="background-selector">
      <button className="back-button" onClick={handleBack}>
        ← Back to Categories
      </button>
      <div className="category-header" style={{ borderColor: currentCategory.color }}>
        <span className="category-icon-small" style={{ backgroundColor: currentCategory.color }}>
          {currentCategory.icon}
        </span>
        <div>
          <h3>{currentCategory.title}</h3>
          <p>{currentCategory.subtitle}</p>
        </div>
      </div>
      
      {/* Horizontal scrolling container with navigation arrows */}
      <div className="horizontal-scroll-wrapper">
        <button className="scroll-arrow scroll-arrow-left" onClick={scrollLeft}>
          ‹
        </button>
        
        <div className="background-horizontal-scroll" ref={scrollContainerRef}>
          <div className="background-row">
            {currentCategory.backgrounds.map((bg) => (
              <div
                key={bg.id}
                className="background-card-horizontal"
                onClick={() => handleBackgroundSelect(bg)}
              >
                <div className="background-image-wrapper">
                  <img
                    src={`${API_URL}${bg.thumbnail}`}  // Changed from just {bg.thumbnail}
                    alt={bg.name}
                    className="background-thumbnail-horizontal"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${API_URL}/backgrounds/placeholder.jpg`;
                    }}
                  />
                </div>
                <div className="background-info-horizontal">
                  <h4>{bg.name}</h4>
                  <p>{bg.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button className="scroll-arrow scroll-arrow-right" onClick={scrollRight}>
          ›
        </button>
      </div>
    </div>
  );
}

export default BackgroundSelector;