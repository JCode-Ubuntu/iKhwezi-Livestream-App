import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const NavVisibilityContext = createContext({
  navVisible: true,
  isHomeRoute: false,
  setDockForcedHidden: () => {},
});

const SCROLL_STOP_MS = 300;
const SCROLL_DELTA = 8;

const SCROLL_SELECTORS = [
  '.ultima-main .ultima-page.ultima-scroll',
  '.ultima-main .ultima-page--flush',
  '.ultima-main .ultima-nav-scroll',
].join(', ');

export function NavVisibilityProvider({ children }) {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';
  const [navVisible, setNavVisible] = useState(true);
  const [dockForcedHidden, setDockForcedHidden] = useState(false);
  const lastScrollTop = useRef(0);
  const stopTimer = useRef(null);
  const scrollElRef = useRef(null);

  const showNav = useCallback(() => {
    if (!isHomeRoute) setNavVisible(true);
  }, [isHomeRoute]);

  const hideNav = useCallback(() => {
    if (!isHomeRoute) setNavVisible(false);
  }, [isHomeRoute]);

  const handleScroll = useCallback(() => {
    if (isHomeRoute) return;
    const el = scrollElRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const delta = scrollTop - lastScrollTop.current;

    clearTimeout(stopTimer.current);

    if (delta > SCROLL_DELTA) hideNav();
    else if (delta < -SCROLL_DELTA) showNav();

    stopTimer.current = setTimeout(showNav, SCROLL_STOP_MS);
    lastScrollTop.current = scrollTop;
  }, [isHomeRoute, hideNav, showNav]);

  useEffect(() => {
    setNavVisible(true);
    setDockForcedHidden(false);
    lastScrollTop.current = 0;

    let attachedEl = null;

    const attach = () => {
      const el = document.querySelector(SCROLL_SELECTORS);
      if (!el || el === attachedEl) return;
      if (attachedEl) attachedEl.removeEventListener('scroll', handleScroll);
      attachedEl = el;
      scrollElRef.current = el;
      el.addEventListener('scroll', handleScroll, { passive: true });
    };

    const raf = requestAnimationFrame(() => requestAnimationFrame(attach));

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stopTimer.current);
      if (attachedEl) attachedEl.removeEventListener('scroll', handleScroll);
      scrollElRef.current = null;
    };
  }, [location.pathname, handleScroll]);

  useEffect(() => {
    if (isHomeRoute) setNavVisible(true);
  }, [isHomeRoute]);

  useEffect(() => {
    const hidden = !isHomeRoute && (!navVisible || dockForcedHidden);
    document.body.classList.toggle('ultima-nav-hidden', hidden);
    return () => document.body.classList.remove('ultima-nav-hidden');
  }, [navVisible, isHomeRoute, dockForcedHidden]);

  const dockVisible = isHomeRoute || (navVisible && !dockForcedHidden);

  return (
    <NavVisibilityContext.Provider
      value={{ navVisible: dockVisible, isHomeRoute, setDockForcedHidden }}
    >
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility() {
  return useContext(NavVisibilityContext);
}

export function useNavDock() {
  const { setDockForcedHidden } = useNavVisibility();
  return {
    hideDock: useCallback(() => setDockForcedHidden(true), [setDockForcedHidden]),
    showDock: useCallback(() => setDockForcedHidden(false), [setDockForcedHidden]),
  };
}
