import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NavVisibilityContext = createContext({
  navVisible: true,
  setDockForcedHidden: () => {},
});

export function NavVisibilityProvider({ children }) {
  const [dockForcedHidden, setDockForcedHidden] = useState(false);
  const navVisible = !dockForcedHidden;

  useEffect(() => {
    document.body.classList.toggle('ultima-nav-hidden', dockForcedHidden);
    return () => document.body.classList.remove('ultima-nav-hidden');
  }, [dockForcedHidden]);

  const setForcedHidden = useCallback((hidden) => {
    setDockForcedHidden(!!hidden);
  }, []);

  return (
    <NavVisibilityContext.Provider value={{ navVisible, setDockForcedHidden: setForcedHidden }}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility() {
  return useContext(NavVisibilityContext);
}

/** @deprecated Prefer setDockForcedHidden only for Create flow; nav stays fixed elsewhere. */
export function useNavDock() {
  const { setDockForcedHidden } = useNavVisibility();
  return {
    hideDock: useCallback(() => setDockForcedHidden(true), [setDockForcedHidden]),
    showDock: useCallback(() => setDockForcedHidden(false), [setDockForcedHidden]),
  };
}
