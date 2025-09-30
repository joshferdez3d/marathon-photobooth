import React, { useState } from 'react';

function ResultDisplay({ imageUrl, onStartOver }) {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `amsterdam-marathon-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEmailShare = async () => {
    // Implement email sharing logic here
    // This would connect to your backend email service
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="result-display">
      <h3>🎉 Your Marathon Photo is Ready!</h3>
      
      <div className="result-image-container">
        <img src={imageUrl} alt="Generated marathon photo" className="result-image" />
      </div>

      <div className="action-buttons">
        <button onClick={handleDownload} className="btn btn-download">
          ⬇️ Download Photo
        </button>

        <div className="email-share">
          <input
            type="email"
            placeholder="Enter email to share"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
          <button 
            onClick={handleEmailShare} 
            className="btn btn-email"
            disabled={!email || emailSent}
          >
            {emailSent ? '✅ Sent!' : '📧 Email'}
          </button>
        </div>

        <button onClick={onStartOver} className="btn btn-new">
          🔄 Take Another Photo
        </button>
      </div>

      <div className="social-message">
        <p>Share your Amsterdam Marathon 2025 moment!</p>
        <p className="hashtag">#AmsterdamMarathon2025 #AIPhotoBooth</p>
      </div>
    </div>
  );
}

export default ResultDisplay;