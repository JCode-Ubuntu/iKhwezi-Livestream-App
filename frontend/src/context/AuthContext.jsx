import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getApiBase } from '../config/appConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ikhwezi_token'));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestInteractions, setGuestInteractions] = useState(0);
  const toastTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchWithAuth = useCallback(async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
    });
    
    return response;
  }, [token]);

  const fetchMe = useCallback(async () => {
    if (!token) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    
    try {
      const response = await fetchWithAuth('/auth/me');
      if (!mountedRef.current) return;
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setIsGuest(!!data.isGuest);
      } else {
        localStorage.removeItem('ikhwezi_token');
        setToken(null);
        setUser(null);
        setIsGuest(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, fetchWithAuth]);

  // Generates a random guest identifier. Not cryptographically significant —
  // this only needs to be unique enough to avoid a username collision on
  // registration, which is why createGuestSession() below still retries with
  // a fresh id rather than trusting uniqueness outright.
  const randomGuestSuffix = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  };

  const createGuestSession = useCallback(async (attempt = 0) => {
    const guestUsername = `guest_${randomGuestSuffix()}`;
    try {
      const response = await fetch(`${getApiBase()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: guestUsername,
          password: 'guest_password_' + Math.random(),
          email: `${guestUsername}@guest.local`,
          displayName: 'Guest User',
          isGuest: true
        }),
      });

      if (!mountedRef.current) return;

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('ikhwezi_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setIsGuest(true);
        return;
      }

      // Username collisions are the one realistically retryable failure here
      // (409/400 from the backend's unique constraint) — anything else
      // (network down, 500, etc.) retrying immediately won't help.
      if (response.status === 409 || response.status === 400) {
        if (attempt < 2) {
          return createGuestSession(attempt + 1);
        }
      }
      console.error('Guest session creation failed with status', response.status);
      showToast("Couldn't start a session — check your connection and try reloading.", 'error');
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Guest session creation failed:', err);
      showToast("Couldn't start a session — check your connection and try reloading.", 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // React StrictMode runs effect cleanup then re-runs the effect in dev.
    // Without resetting this flag, the second run keeps mountedRef=false and
    // every async finally skips setLoading(false) — app stuck on UltimaLoading.
    mountedRef.current = true;

    if (token) {
      fetchMe();
    } else {
      createGuestSession();
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = async (credentials) => {
    try {
      const response = await fetch(`${getApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      localStorage.setItem('ikhwezi_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setIsGuest(false);
      setGuestInteractions(0);
      showToast('Welcome back!', 'success');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${getApiBase()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      localStorage.setItem('ikhwezi_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setIsGuest(false);
      setGuestInteractions(0);
      showToast('Welcome to iKHWEZI!', 'success');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('ikhwezi_token');
    setToken(null);
    setUser(null);
    setIsGuest(false);
    setGuestInteractions(0);
    showToast('Logged out', 'success');
    // Re-bootstrap a guest session so the app isn't left in a broken no-auth state.
    createGuestSession();
  };

  const trackGuestInteraction = useCallback(() => {
    if (isGuest) {
      setGuestInteractions(prev => prev + 1);
    }
  }, [isGuest]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isGuest,
    guestInteractions,
    trackGuestInteraction,
    login,
    register,
    logout,
    fetchWithAuth,
    showToast,
    toast,
    refreshUser: fetchMe,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
