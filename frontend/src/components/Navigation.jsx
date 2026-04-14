import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Radio, User, LogIn, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from './GuestPrompt';

function Navigation({ onCreateClick }) {
  const { isAuthenticated, user, isGuest, trackGuestInteraction } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  if (location.pathname === '/admin') {
    return null;
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/live', icon: Radio, label: 'Live' },
  ];

  const handleCreateClick = () => {
    if (isGuest) {
      trackGuestInteraction();
      setShowUpgradePrompt(true);
    } else {
      onCreateClick?.();
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] flex h-[70px] items-center justify-around border-t border-white/5 bg-gradient-to-t from-[#050816]/98 to-[#0a0f1f]/90 px-5 shadow-[0_-8px_40px_rgba(99,102,241,0.12)] backdrop-blur-2xl"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        {isGuest && (
          <div
            style={{
              position: 'absolute',
              top: -36,
              left: 12,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.5px',
              padding: '4px 12px',
              borderRadius: 12,
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#6F4FFF',
              border: '1px solid rgba(111, 79, 255, 0.3)',
            }}
          >
            👤 GUEST MODE
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/');

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-95 ${
                isActive
                  ? 'text-neon-indigo shadow-[0_0_24px_rgba(99,102,241,0.35)]'
                  : 'text-white/50 hover:text-white/80'
              }`}
              style={{
                background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              }}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span
                className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-neon-indigo shadow-[0_0_10px_#6366f1]" />
              )}
            </NavLink>
          );
        })}
        <button
          onClick={handleCreateClick}
          className="relative flex flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-95 text-white/50 hover:text-white/80"
          style={{
            background: isGuest ? 'rgba(255, 107, 107, 0.1)' : 'transparent',
          }}
          title={isGuest ? 'Sign up to create' : 'Create a video'}
        >
          <div className="relative">
            <Plus size={24} strokeWidth={2} />
            <div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
              style={{
                background: isGuest ? 'linear-gradient(135deg, #FF6B6B, #FF4757)' : 'linear-gradient(135deg, #10B981, #6F4FFF)',
                boxShadow: isGuest ? '0 0 8px rgba(255, 87, 87, 0.5)' : '0 0 8px rgba(16, 185, 129, 0.5)'
              }}
            />
          </div>
          <span className="text-[11px] font-medium">Create</span>
        </button>

        <NavLink
          to={user ? `/profile/${user?.id}` : '/'}
          className={`relative flex flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-95 ${
            location.pathname === `/profile/${user?.id}` || location.pathname.startsWith('/profile/')
              ? 'text-neon-indigo shadow-[0_0_24px_rgba(99,102,241,0.35)]'
              : 'text-white/50 hover:text-white/80'
          }`}
          style={{
            background: location.pathname === `/profile/${user?.id}` || location.pathname.startsWith('/profile/') ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
          }}
        >
          <User size={24} strokeWidth={location.pathname === `/profile/${user?.id}` || location.pathname.startsWith('/profile/') ? 2.5 : 2} />
          <span
            className={`text-[11px] ${location.pathname === `/profile/${user?.id}` || location.pathname.startsWith('/profile/') ? 'font-semibold' : 'font-medium'}`}
          >
            Profile
          </span>
          {(location.pathname === `/profile/${user?.id}` || location.pathname.startsWith('/profile/')) && (
            <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-neon-indigo shadow-[0_0_10px_#6366f1]" />
          )}
        </NavLink>
      </nav>

      {showUpgradePrompt && (
        <GuestPrompt 
          onClose={() => setShowUpgradePrompt(false)} 
          context="create"
        />
      )}
    </>
  );
}

export default Navigation;
