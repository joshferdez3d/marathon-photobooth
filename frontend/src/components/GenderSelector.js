import React, { useState } from 'react';
import './GenderSelector.css';
import maleIcon from '../assets/icons/male-icon.png';
import femaleIcon from '../assets/icons/female-icon.png';
function GenderSelector({ onSelect }) {
  const [selectedGender, setSelectedGender] = useState(null);

  const genderOptions = [
    { id: 'male', label: 'Male', icon: maleIcon },
    { id: 'female', label: 'Female', icon: femaleIcon },
  ];
  
  const handleSelect = (genderId) => {
    setSelectedGender(genderId);
    onSelect(genderId);
  };

  return (
    <div className="gender-selector-new">
      <h2>Select your <span className="highlight-text">body type</span></h2>
      <p className="subtitle">This helps us create appropriate athletic wear for your photo</p>
      <div className="gender-options-new">
        {genderOptions.map((option) => (
          <button
            key={option.id}
            className={`gender-card ${selectedGender === option.id ? 'selected' : ''}`}
            onClick={() => handleSelect(option.id)}
          >
            {selectedGender === option.id && (
              <div className="checkmark">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white"/>
                </svg>
              </div>
            )}
            <div className="gender-icon-wrapper">
              <img src={option.icon} alt={option.label} className="gender-icon-img" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default GenderSelector;