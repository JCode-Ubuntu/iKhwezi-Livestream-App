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
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 70,
      background: 'linear-gradient(to top, rgba(13, 15, 26, 0.98), rgba(13, 15, 26, 0.9))',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0 20px',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      zIndex: 100,
    }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || 
          (item.path === '/' && location.pathname === '/');
        
        return (
          <NavLink
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 16px',
              borderRadius: 12,
              color: isActive ? '#6F4FFF' : '#A0A0A0',
              transition: 'all 0.3s ease',
              background: isActive ? 'rgba(111, 79, 255, 0.1)' : 'transparent',
            }}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span style={{
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
            }}>
              {item.label}
            </span>
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: 8,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: '#6F4FFF',
                boxShadow: '0 0 10px #6F4FFF',
              }} />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default Navigation;
