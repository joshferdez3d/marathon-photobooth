import React from 'react';

function GenderSelector({ onSelect }) {
  const genderOptions = [
    { id: 'male', label: 'Male', icon: '👨' },
    { id: 'female', label: 'Female', icon: '👩' },
    { id: 'non-binary', label: 'Non-Binary', icon: '🧑' },
    { id: 'trans', label: 'Trans', icon: '⚧' }
  ];

  return (
    <div className="gender-selector">
      <h3>Select Your Gender Identity</h3>
      <p className="subtitle">This helps us create appropriate athletic wear for your photo</p>
      <div className="gender-options">
        {genderOptions.map((option) => (
          <button
            key={option.id}
            className="gender-button"
            onClick={() => onSelect(option.id)}
          >
            <span className="gender-icon">{option.icon}</span>
            <span className="gender-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default GenderSelector;