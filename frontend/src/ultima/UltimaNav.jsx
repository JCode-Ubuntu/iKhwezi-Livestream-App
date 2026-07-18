import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Play, Search, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavVisibility } from '../context/NavVisibilityContext';
import GuestPrompt from '../components/GuestPrompt';
import IkCreateLogo from './IkCreateLogo';
import { getApiBase, resolveMediaUrl } from '../config/appConfig';

function NavIcon({ item, active, profileAvatar, profileInitial }) {
  if (item.id === 'profile') {
    if (profileAvatar) {
      return (
        <img
          src={profileAvatar}
          alt=""
          className={`relative z-10 h-[22px] w-[22px] rounded-full object-cover ring-2 ${
            active ? 'ring-pink-400/60' : 'ring-white/20'
          }`}
        />
      );
    }
    return (
      <div
        className={`relative z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold text-white ${
          active ? 'ring-2 ring-pink-400/60' : ''
        }`}
        style={{ background: 'linear-gradient(135deg,#E1306C,#F5C542)' }}
      >
        {profileInitial}
      </div>
    );
  }

  const Icon = item.icon;
  return (
    <Icon
      size={22}
      strokeWidth={active ? 2.5 : 2}
      className={`relative z-10 ${item.filled ? 'fill-current' : ''}`}
    />
  );
}

function UltimaNav({ onCreateClick }) {
  const { isAuthenticated, user, isGuest, trackGuestInteraction } = useAuth();
  const { navVisible, isHomeRoute } = useNavVisibility();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${getApiBase()}/live/status`);
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

  const dockHidden = !navVisible && !isHomeRoute;
  const fabMotion = dockHidden
    ? 'translate-y-[120%] opacity-0 pointer-events-none'
    : 'translate-y-0 opacity-100';

  const handleCreate = () => {
    if (isGuest) {
      trackGuestInteraction();
      setShowUpgradePrompt(true);
    } else {
      onCreateClick?.();
    }
  };

  const profilePath = user ? `/profile/${user.id}` : '/login';
  const profileAvatar = user?.avatar ? resolveMediaUrl(user.avatar) : null;
  const profileInitial = (user?.username || '?').charAt(0).toUpperCase();

  const navItems = [
    { id: 'home', path: '/', icon: Home, label: 'Home', isActive: (p) => p === '/' },
    { id: 'reels', path: '/reels', icon: Play, label: 'Reels', filled: true, isActive: (p) => p === '/reels' || p === '/live' },
    { id: 'create', type: 'action', label: 'Create' },
    { id: 'search', path: '/explore', icon: Search, label: 'Search', isActive: (p) => p === '/explore' },
    { id: 'profile', path: profilePath, label: 'Profile', isActive: (p) => p.startsWith('/profile') },
  ];

  const navItemClass = (active) =>
    `relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2 transition-all duration-300 active:scale-90 sm:px-4 ${
      active ? 'text-pink-300' : 'text-white/45 hover:text-white/75'
    }`;

  const isAdmin = !!user?.isAdmin;

  return (
    <>
      {isAdmin && !['/reels'].includes(location.pathname) && (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className={`ik-tap-spring fixed z-[95] flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white transition-all duration-[220ms] ease-out ${fabMotion}`}
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
          className={`ik-tap-spring fixed z-[95] flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white transition-all duration-[220ms] ease-out ${fabMotion}`}
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
        className={`ultima-dock supreme fixed bottom-4 left-1/2 z-[90] flex max-w-[min(100vw-1rem,520px)] -translate-x-1/2 items-center justify-between gap-0 rounded-[32px] px-1.5 py-2 backdrop-blur-3xl sm:gap-0.5 sm:px-2.5 ${
          dockHidden ? 'ultima-dock--hidden' : ''
        }`}
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        aria-label="Primary"
        aria-hidden={dockHidden}
      >
        {isGuest && (
          <span className="mr-0.5 rounded-full border border-gold-400/20 bg-gold-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-gold-300/80 sm:mr-1 sm:px-2 sm:text-[8px]">
            Guest
          </span>
        )}

        {navItems.map((item) => {
          if (item.type === 'action') {
            return (
              <button
                key={item.id}
                type="button"
                onClick={handleCreate}
                className="ultima-dock-create relative mx-0.5 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] sm:mx-1.5 sm:h-[52px] sm:w-[52px] sm:rounded-[20px]"
                aria-label={item.label}
              >
                <IkCreateLogo className="relative z-[2] h-[26px] w-[26px] sm:h-[30px] sm:w-[30px]" />
              </button>
            );
          }

          const active = item.isActive(location.pathname);
          return (
            <NavLink key={item.id} to={item.path} className={navItemClass(active)}>
              {active && (
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-pink-500/18 to-gold-400/10" />
              )}
              <NavIcon
                item={item}
                active={active}
                profileAvatar={profileAvatar}
                profileInitial={profileInitial}
              />
              <span className="relative z-10 text-[8px] font-semibold uppercase tracking-wider sm:text-[9px]">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {showUpgradePrompt && (
        <GuestPrompt onClose={() => setShowUpgradePrompt(false)} context="create" />
      )}
    </>
  );
}

export default UltimaNav;
