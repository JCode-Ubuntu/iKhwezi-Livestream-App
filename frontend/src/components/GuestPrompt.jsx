import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LogIn, UserPlus, Star, Heart, MessageCircle, UserCheck, Bell, Zap,
} from 'lucide-react';

import '../ultima/guest-prompt.css';

const FEATURES = [
  { icon: Star, text: 'Give stars to creators', color: '#F5C542', bg: 'rgba(245, 197, 66, 0.14)' },
  { icon: Heart, text: 'Like your favorite videos', color: '#E1306C', bg: 'rgba(225, 48, 108, 0.14)' },
  { icon: MessageCircle, text: 'Comment and reply', color: '#22D3EE', bg: 'rgba(34, 211, 238, 0.12)' },
  { icon: Bell, text: 'Alerts 🔔', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)' },
  { icon: UserCheck, text: 'Follow creators you love', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
];

const MESSAGES = {
  default: {
    title: 'Join iKHWEZI',
    subtitle: 'Sign in to unlock all features',
  },
  interaction: {
    title: 'Create Your Account',
    subtitle: 'Get access to all features and personalize your experience',
  },
  create: {
    title: 'Ready to Create?',
    subtitle: 'Sign up to start uploading, going live, and connecting',
  },
};

function GuestPrompt({ onClose, context = 'default' }) {
  const navigate = useNavigate();
  const msg = MESSAGES[context] || MESSAGES.default;

  const goRegister = () => {
    onClose();
    navigate('/register');
  };

  const goLogin = () => {
    onClose();
    navigate('/login');
  };

  return (
    <div
      className="guest-prompt-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-labelledby="guest-prompt-title"
    >
      <div className="guest-prompt-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="guest-prompt-handle" aria-hidden />

        <header className="guest-prompt-header">
          <button
            type="button"
            onClick={onClose}
            className="guest-prompt-back"
            aria-label="Return to menu"
          >
            <ArrowLeft size={16} strokeWidth={2.25} />
            Menu
          </button>
        </header>

        <div className="guest-prompt-hero">
          <Zap size={22} color="white" fill="white" />
        </div>

        <h2 id="guest-prompt-title" className="guest-prompt-title">
          {context === 'interaction' && <span className="mr-1">✨</span>}
          {context === 'create' && <span className="mr-1">🎬</span>}
          {msg.title}
        </h2>
        <p className="guest-prompt-sub">{msg.subtitle}</p>

        <ul className="guest-prompt-features">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.text} className="guest-prompt-feature">
                <div
                  className="guest-prompt-feature-icon"
                  style={{ background: feature.bg }}
                >
                  <Icon size={16} color={feature.color} strokeWidth={2.25} />
                </div>
                <span className="guest-prompt-feature-text">{feature.text}</span>
              </li>
            );
          })}
        </ul>

        <div className="guest-prompt-actions">
          <button type="button" onClick={goRegister} className="guest-prompt-btn-primary">
            <UserPlus size={17} strokeWidth={2.25} />
            Create Free Account
          </button>
          <button type="button" onClick={goLogin} className="guest-prompt-btn-secondary">
            <LogIn size={17} strokeWidth={2.25} />
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuestPrompt;
