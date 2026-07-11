import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Clapperboard, User, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';
import IkCreateLogo from './IkCreateLogo';

function UltimaNav({ onCreateClick }) {
  const { isAuthenticated, user, isGuest, trackGuestInteraction } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/live/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setIsLive(!!data.isLive);
      } catch (_) {
        /* ignore */
      }
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (['/admin', '/login', '/register'].includes(location.pathname)) return null;

  const items = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/explore', icon: Search, label: 'Search' },
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
  const reelsActive = location.pathname === '/reels' || location.pathname === '/live';
  const isAdmin = !!user?.isAdmin;

  return (
    <>
      {isAdmin && !['/reels'].includes(location.pathname) && (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="ik-tap-spring fixed z-[95] flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white"
          style={{
            right: '16px',
            bottom: 'calc(var(--ultima-nav-offset, 6.5rem) + 12px)',
            background: 'linear-gradient(135deg, #E1306C 0%, #B91C58 100%)',
            boxShadow: '0 8px 28px rgba(225,48,108,0.5), 0 0 40px rgba(225,48,108,0.25)',
          }}
          aria-label="Go Live"
        >
          <Radio size={15} strokeWidth={2.5} className="animate-pulse" />
          Go Live
        </button>
      )}

      {isLive && location.pathname !== '/live' && (
        <button
          type="button"
          onClick={() => navigate('/live')}
          className="ik-tap-spring fixed z-[95] flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white"
          style={{
            left: '16px',
            bottom: 'calc(var(--ultima-nav-offset, 6.5rem) + 12px)',
            background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
            boxShadow: '0 8px 28px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.25)',
          }}
          aria-label="Watch live"
        >
          <Radio size={15} strokeWidth={2.5} className="animate-pulse" />
          Live now
        </button>
      )}

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

        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-90 ${
                active ? 'text-pink-300' : 'text-white/45 hover:text-white/75'
              }`}
            >
              {active && (
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-pink-500/18 to-gold-400/10" />
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
          className="ultima-dock-create relative mx-1.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[20px]"
          aria-label="Create"
        >
          <IkCreateLogo className="relative z-[2] h-[30px] w-[30px]" />
        </button>

        <NavLink
          to="/reels"
          className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-90 ${
            reelsActive ? 'text-pink-300' : 'text-white/45 hover:text-white/75'
          }`}
        >
          {reelsActive && (
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-pink-500/18 to-gold-400/10" />
          )}
          <Clapperboard size={22} strokeWidth={reelsActive ? 2.5 : 2} className="relative z-10" />
          <span className="relative z-10 text-[9px] font-semibold uppercase tracking-wider">Reels</span>
        </NavLink>

        <NavLink
          to={user ? `/profile/${user.id}` : '/login'}
          className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-all duration-300 active:scale-90 ${
            profileActive ? 'text-pink-300' : 'text-white/45 hover:text-white/75'
          }`}
        >
          {profileActive && (
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-pink-500/18 to-gold-400/10" />
          )}
          <User size={22} strokeWidth={profileActive ? 2.5 : 2} className="relative z-10" />
          <span className="relative z-10 text-[9px] font-semibold uppercase tracking-wider">Profile</span>
        </NavLink>
      </nav>

      {showUpgradePrompt && (
        <GuestPrompt onClose={() => setShowUpgradePrompt(false)} context="create" />
      )}
    </>
  );
}

export default UltimaNav;
