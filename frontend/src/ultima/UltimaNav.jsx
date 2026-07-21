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
          className={`relative z-10 h-[21px] w-[21px] rounded-full object-cover ring-2 ${
            active ? 'ring-pink-400/60' : 'ring-white/20'
          }`}
        />
      );
    }
    return (
      <div
        className={`relative z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full text-[10px] font-bold text-white ${
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
      size={21}
      strokeWidth={active ? 2.5 : 2}
      className={`relative z-10 ${item.filled ? 'fill-current' : ''}`}
    />
  );
}

function UltimaNav({ onCreateClick }) {
  const { isAuthenticated, user, isGuest, trackGuestInteraction } = useAuth();
  const { navVisible } = useNavVisibility();
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
    `relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-all duration-300 active:scale-90 sm:px-3.5 ${
      active ? 'text-pink-300' : 'text-white/45 hover:text-white/75'
    }`;

  const isAdmin = !!user?.isAdmin;
  const fabMotion = navVisible
    ? 'translate-y-0 opacity-100'
    : 'translate-y-2 opacity-0 pointer-events-none';

  return (
    <>
      {isAdmin && !['/reels'].includes(location.pathname) && (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className={`ik-tap-spring fixed z-[95] flex items-center gap-2 rounded-full px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white transition-all duration-[220ms] ease-out ${fabMotion}`}
          style={{
            right: '16px',
            bottom: 'calc(var(--ultima-nav-offset, 6.37rem) + 8px)',
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
            bottom: 'calc(var(--ultima-nav-offset, 6.37rem) + 8px)',
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
        className={`ultima-dock ultima-dock--frame ${navVisible ? '' : 'ultima-dock--hidden'}`}
        aria-label="Primary"
        aria-hidden={!navVisible}
      >
        <div className="ultima-dock-inner">
          {isGuest && (
            <span className="ultima-dock-guest hidden sm:inline-flex">Guest</span>
          )}

          {navItems.map((item) => {
            if (item.type === 'action') {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={handleCreate}
                  className="ultima-dock-create relative mx-0.5 flex h-[47px] w-[47px] shrink-0 items-center justify-center rounded-[17px] sm:mx-1 sm:h-[50px] sm:w-[50px] sm:rounded-[18px]"
                  aria-label={item.label}
                >
                  <IkCreateLogo className="relative z-[2] h-[25px] w-[25px] sm:h-[28px] sm:w-[28px]" />
                </button>
              );
            }

            const active = item.isActive(location.pathname);
            return (
              <NavLink key={item.id} to={item.path} className={navItemClass(active)}>
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-pink-500/18 to-gold-400/10" />
                )}
                <NavIcon
                  item={item}
                  active={active}
                  profileAvatar={profileAvatar}
                  profileInitial={profileInitial}
                />
                <span className="relative z-10 text-[7.5px] font-semibold uppercase tracking-wider sm:text-[9px]">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {showUpgradePrompt && (
        <GuestPrompt onClose={() => setShowUpgradePrompt(false)} context="create" />
      )}
    </>
  );
}

export default UltimaNav;
