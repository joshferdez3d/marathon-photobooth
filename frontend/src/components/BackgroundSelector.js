import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BackgroundSelector({ onSelect }) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const fetchBackgrounds = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/backgrounds`);
      setBackgrounds(response.data);
    } catch (error) {
      console.error('Failed to fetch backgrounds:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading backgrounds...</div>;

  return (
    <div className="background-selector">
      <h3>Choose Your Marathon Location</h3>
      <div className="background-grid">
        {backgrounds.map((bg) => (
          <div 
            key={bg.id} 
            className="background-card"
            onClick={() => onSelect(bg)}
          >
            <img 
              src={`${API_URL}${bg.thumbnail}`} 
              alt={bg.name}
              className="background-thumbnail"
            />
            <h4>{bg.name}</h4>
            <p>{bg.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BackgroundSelector;