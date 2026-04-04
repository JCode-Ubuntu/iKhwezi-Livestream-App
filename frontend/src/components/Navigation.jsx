import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Radio, User, LogIn, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Navigation({ onCreateClick }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (location.pathname === '/admin') {
    return null;
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/live', icon: Radio, label: 'Live' },
    // Always show profile for free access
    user ? { path: `/profile/${user?.id}`, icon: User, label: 'Profile' } : { path: '/', icon: User, label: 'Profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] flex h-[70px] items-center justify-around border-t border-white/5 bg-gradient-to-t from-[#050816]/98 to-[#0a0f1f]/90 px-5 shadow-[0_-8px_40px_rgba(99,102,241,0.12)] backdrop-blur-2xl"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
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
        onClick={onCreateClick}
        className="relative flex flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-95 text-white/50 hover:text-white/80"
        style={{
          background: 'transparent',
        }}
        title="Create a video"
      >
        <div className="relative">
          <Plus size={24} strokeWidth={2} />
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #10B981, #6F4FFF)',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
            }}
          />
        </div>
        <span className="text-[11px] font-medium">Create</span>
      </button>
    </nav>
  );
}

export default Navigation;
