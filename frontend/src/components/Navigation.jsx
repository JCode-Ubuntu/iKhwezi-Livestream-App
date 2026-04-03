import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Radio, User, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Navigation() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (location.pathname === '/admin') {
    return null;
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/live', icon: Radio, label: 'Live' },
    isAuthenticated
      ? { path: `/profile/${user?.id}`, icon: User, label: 'Profile' }
      : { path: '/login', icon: LogIn, label: 'Login' },
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
    </nav>
  );
}

export default Navigation;
