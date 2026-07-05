import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Radio, MessageCircle, Plus, User, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';

function UltimaNav({ onCreateClick }) {
  const { isAuthenticated, user, isGuest, trackGuestInteraction } = useAuth();
  const location = useLocation();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  if (['/admin', '/login', '/register'].includes(location.pathname)) return null;

  const items = [
    { path: '/', icon: Home, label: 'Signal' },
    { path: '/live', icon: Radio, label: 'Live' },
    { path: '/messages', icon: MessageCircle, label: 'Pulse', authOnly: true },
  ];

  const handleCreate = () => {
    if (isGuest) {
      trackGuestInteraction();
      setShowUpgradePrompt(true);
    } else {
      onCreateClick?.();
    }
  };

  const profileActive = location.pathname.startsWith('/profile');

  return (
    <>
      <nav
        className="ultima-dock supreme fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-0.5 rounded-[32px] px-2.5 py-2 backdrop-blur-3xl"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        aria-label="Primary"
      >
        {isGuest && (
          <span className="mr-1 rounded-full border border-gold-400/20 bg-gold-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gold-300/80">
            Guest
          </span>
        )}

        {items.filter((i) => !i.authOnly || (isAuthenticated && !isGuest)).map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-90 ${
                active ? 'text-gold-300' : 'text-white/45 hover:text-white/75'
              }`}
            >
              {active && (
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gold-400/15 to-violet-500/10" />
              )}
              <Icon size={22} strokeWidth={active ? 2.5 : 2} className="relative z-10" />
              <span className="relative z-10 text-[9px] font-semibold uppercase tracking-wider">
                {item.label}
              </span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={handleCreate}
          className="ultima-dock-create relative mx-1.5 flex h-[52px] w-[52px] items-center justify-center rounded-[20px] text-void-950 transition-transform active:scale-90"
          aria-label="Create"
        >
          <Plus size={24} strokeWidth={2.5} />
          <Sparkles size={10} className="absolute -right-0.5 -top-0.5 text-white/90" />
        </button>

        <NavLink
          to={user ? `/profile/${user.id}` : '/login'}
          className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-90 ${
            profileActive ? 'text-gold-300' : 'text-white/45 hover:text-white/75'
          }`}
        >
          {profileActive && (
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gold-400/15 to-violet-500/10" />
          )}
          <User size={22} strokeWidth={profileActive ? 2.5 : 2} className="relative z-10" />
          <span className="relative z-10 text-[9px] font-semibold uppercase tracking-wider">Self</span>
        </NavLink>
      </nav>

      {showUpgradePrompt && (
        <GuestPrompt onClose={() => setShowUpgradePrompt(false)} context="create" />
      )}
    </>
  );
}

export default UltimaNav;
