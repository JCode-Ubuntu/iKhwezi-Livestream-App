import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IKHWEZI_LOGO_URL } from '../config/brandAssets';
import './Splash.css';

export default function Splash({ showButtons = false }) {
  const navigate = useNavigate();

  return (
    <div className="splash-root">
      <div className="splash-aurora" />
      <div className="splash-content">
        <img src={IKHWEZI_LOGO_URL} alt="iKhwezi" className="splash-logo-image" />
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
