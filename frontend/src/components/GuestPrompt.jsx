import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogIn, UserPlus, Star, Heart, MessageCircle, UserCheck } from 'lucide-react';

function GuestPrompt({ onClose }) {
  const navigate = useNavigate();

  const features = [
    { icon: Star, text: 'Give stars to creators', color: '#FFB800' },
    { icon: Heart, text: 'Like your favorite videos', color: '#EF4444' },
    { icon: MessageCircle, text: 'Comment and reply', color: '#6F4FFF' },
    { icon: UserCheck, text: 'Follow creators you love', color: '#10B981' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <button onClick={onClose} className="close-btn" style={{ position: 'absolute', right: 16, top: 16 }}>
          <X size={20} />
        </button>

        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6F4FFF, #FFB800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 10px 40px rgba(111, 79, 255, 0.4)',
        }}>
          <Star size={36} color="white" fill="white" />
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Join iKHWEZI
        </h2>
        <p style={{ color: '#A0A0A0', marginBottom: 24 }}>
          Sign in to unlock all features
        </p>

        <div style={{ marginBottom: 24, textAlign: 'left' }}>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: index < features.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${feature.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={18} color={feature.color} />
                </div>
                <span style={{ fontSize: 14, color: '#E0E0E0' }}>{feature.text}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => { onClose(); navigate('/register'); }}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <UserPlus size={18} />
            Create Account
          </button>
          <button
            onClick={() => { onClose(); navigate('/login'); }}
            className="btn btn-outline"
            style={{ width: '100%' }}
          >
            <LogIn size={18} />
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuestPrompt;
