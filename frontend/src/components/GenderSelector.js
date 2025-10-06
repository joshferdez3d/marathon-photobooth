import React from 'react';
import './GenderSelector.css';

function GenderSelector({ onSelect }) {
  const genderOptions = [
    { id: 'male', label: 'Male', icon: '♂' },
    { id: 'female', label: 'Female', icon: '♀' },
    { id: 'non-binary', label: 'Non-binary / others', icon: '⚥' }
  ];

  return (
    <div className="gender-selector-new">
      <h2>Select your <span className="highlight-text">gender identity</span></h2>
      <p className="subtitle">This helps us create appropriate athletic wear for your photo</p>
      <div className="gender-options-new">
        {genderOptions.map((option) => (
          <button
            key={option.id}
            className="gender-button-new"
            onClick={() => onSelect(option.id)}
          >
            <div className="gender-icon-circle">
              <span className="gender-symbol">{option.icon}</span>
            </div>
            <span className="gender-label-new">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default GenderSelector;