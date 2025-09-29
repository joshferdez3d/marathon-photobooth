import React, { useState } from 'react';
import './BackgroundSelector.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BackgroundSelector({ onSelect }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categories = {
    'amsterdam750': {
      title: 'Amsterdam 750',
      subtitle: 'Historic Journey Through Time',
      description: 'Travel back to Amsterdam\'s Golden Age',
      icon: '🏛️',
      color: '#8B7355',
      backgrounds: [
        {
          id: 'amsterdam750-flowermarket',
          name: 'Historic Flower Market',
          description: 'Classic Amsterdam canal with traditional flower boats',
          thumbnail: `${API_URL}/backgrounds/Amsterdam750-FlowerMarket.png`
        },
        {
          id: 'amsterdam750-goldenage',
          name: 'Golden Age Harbor',
          description: 'Sepia-toned scene from Amsterdam\'s maritime glory',
          thumbnail: `${API_URL}/backgrounds/Amsterdam750-GoldenAge1.png`
        },
        {
          id: 'amsterdam750-rijksmuseum',
          name: 'Rijksmuseum Celebration',
          description: 'Modern crowds celebrating at the iconic museum',
          thumbnail: `${API_URL}/backgrounds/Amsterdam750-Rijksmuseum3.png`
        }
      ]
    },
    'futureofrunning': {
      title: 'Future of Running',
      subtitle: '2050 Marathon Experience',
      description: 'Race through tomorrow\'s Amsterdam',
      icon: '🚀',
      color: '#00B4D8',
      backgrounds: [
        {
          id: 'future-solarbridge',
          name: 'Solar Bridge Run',
          description: 'Futuristic bridge with drone spectators',
          thumbnail: `${API_URL}/backgrounds/FutureofRunning-SolarBridge2.png`
        },
        {
          id: 'future-biodomes',
          name: 'Canal Biodomes',
          description: 'Future Amsterdam with floating ecosystems',
          thumbnail: `${API_URL}/backgrounds/FutureofRunningBiodomes2.png`
        },
        {
          id: 'future-smartfinish',
          name: 'Smart Stadium Finish',
          description: 'High-tech stadium with robotic assistants',
          thumbnail: `${API_URL}/backgrounds/FututeofRunning-SmartFinish5.png`
        }
      ]
    },
    'tcs50': {
      title: 'TCS50',
      subtitle: '50 Years of Marathon Excellence',
      description: 'Celebrating marathon heritage',
      icon: '🏃',
      color: '#4E84C4',
      backgrounds: [
        {
          id: 'tcs50-firstmarathon',
          name: 'The First Marathon',
          description: '1970s Olympic Stadium finish line',
          thumbnail: `${API_URL}/backgrounds/TCS50-FirstMarathon.png`
        },
        {
          id: 'tcs50-iamsterdam',
          name: 'I Amsterdam',
          description: 'Modern marathon at the iconic sign',
          thumbnail: `${API_URL}/backgrounds/TCS50-Iamsterdam.png`
        }
      ]
    }
  };

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

  // Category selection view
  if (!selectedCategory) {
    return (
      <div className="category-selector">
        <h2>Choose Your Marathon Era</h2>
        <p className="subtitle">Select a theme for your marathon journey</p>
        <div className="category-grid">
          {Object.entries(categories).map(([key, category]) => (
            <div
              key={key}
              className="category-card"
              onClick={() => handleCategorySelect(key)}
              style={{ borderColor: category.color }}
            >
              <div className="category-icon" style={{ backgroundColor: category.color }}>
                {category.icon}
              </div>
              <h3>{category.title}</h3>
              <h4>{category.subtitle}</h4>
              <p>{category.description}</p>
              <div className="category-preview">
                <div className="preview-count">
                  {category.backgrounds.length} backgrounds
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Background selection view
  const currentCategory = categories[selectedCategory];
  
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
      <div className="background-grid">
        {currentCategory.backgrounds.map((bg) => (
          <div
            key={bg.id}
            className="background-card"
            onClick={() => handleBackgroundSelect(bg)}
          >
            <div className="background-image-container">
              <img
                src={bg.thumbnail}
                alt={bg.name}
                className="background-thumbnail"
              />
            </div>
            <div className="background-info">
              <h4>{bg.name}</h4>
              <p>{bg.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BackgroundSelector;