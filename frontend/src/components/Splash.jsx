import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Splash.css';

export default function Splash({ showButtons = false }) {
  const navigate = useNavigate();

  return (
    <div className="splash-root">
      <div className="splash-aurora" />
      <div className="splash-content">
        <div className="splash-logo">iK</div>
        <div className="splash-copy">
          <div className="splash-eyebrow">Supreme Edition</div>
          <h1 className="splash-title">iKHWEZI</h1>
          <p className="splash-sub">Stream the night. Shine the signal.</p>
        </div>
        {showButtons && (
          <div className="splash-actions">
            <button
              className="splash-btn splash-btn--primary"
              onClick={() => navigate('/register')}
            >
              Create Account
            </button>
            <button
              className="splash-btn splash-btn--ghost"
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
