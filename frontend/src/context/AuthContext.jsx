import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { getApiBase } from '../config/appConfig';
import { postJson } from '../utils/apiFetch';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const isAuthScreen = ['/login', '/register'].includes(location.pathname);
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

  const randomGuestSuffix = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  };

  const createGuestSession = useCallback(async (attempt = 0) => {
    const guestUsername = `guest_${randomGuestSuffix()}`;
    try {
      const { response, data } = await postJson('/auth/register', {
        username: guestUsername,
        password: 'guest_password_' + Math.random(),
        email: `${guestUsername}@guest.local`,
        displayName: 'Guest User',
      });

      if (!mountedRef.current) return;

      if (response.ok) {
        localStorage.setItem('ikhwezi_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setIsGuest(true);
        return;
      }

      if (response.status === 409 || response.status === 400) {
        if (attempt < 2) {
          return createGuestSession(attempt + 1);
        }
      }
      console.error('Guest session creation failed with status', response.status, data);
      showToast(data.error || "Couldn't start a session — check your connection and try reloading.", 'error');
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Guest session creation failed:', err);
      showToast(err.message || "Couldn't start a session — check your connection and try reloading.", 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [showToast]);

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
        await createGuestSession();
        return;
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, fetchWithAuth, createGuestSession]);

  useEffect(() => {
    // React StrictMode runs effect cleanup then re-runs the effect in dev.
    // Without resetting this flag, the second run keeps mountedRef=false and
    // every async finally skips setLoading(false) — app stuck on UltimaLoading.
    mountedRef.current = true;

    let loadingTimeout;
    if (Capacitor.isNativePlatform()) {
      loadingTimeout = setTimeout(() => {
        if (mountedRef.current) setLoading(false);
      }, 12000);
    }

    if (token) {
      fetchMe();
    } else {
      createGuestSession();
    }

    return () => {
      mountedRef.current = false;
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, []);

  const login = async (credentials) => {
    try {
      const { response, data } = await postJson('/auth/login', credentials);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (!data.token || !data.user) {
        throw new Error('Login response missing token');
      }

      localStorage.setItem('ikhwezi_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setIsGuest(false);
      setGuestInteractions(0);
      showToast('Welcome back!', 'success');
      return { success: true };
    } catch (err) {
      const message =
        err.message === 'Failed to fetch'
          ? 'Cannot reach iKhwezi servers. Check your connection.'
          : err.message;
      console.error('[auth/login]', message, { api: getApiBase(), native: Capacitor.isNativePlatform() });
      showToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const { response, data } = await postJson('/auth/register', userData);

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (!data.token || !data.user) {
        throw new Error('Registration response missing token');
      }

      localStorage.setItem('ikhwezi_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setIsGuest(false);
      setGuestInteractions(0);
      showToast('Welcome to iKHWEZI!', 'success');
      return { success: true };
    } catch (err) {
      const message =
        err.message === 'Failed to fetch'
          ? 'Cannot reach iKhwezi servers. Check your connection.'
          : err.message;
      console.error('[auth/register]', message, { api: getApiBase(), native: Capacitor.isNativePlatform() });
      showToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const logout = useCallback(async () => {
    localStorage.removeItem('ikhwezi_token');
    setToken(null);
    setIsGuest(false);
    setGuestInteractions(0);
    showToast('Logged out', 'success');
    await createGuestSession();
  }, [createGuestSession, showToast]);

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
        <div className={`toast toast-${toast.type}${isAuthScreen ? ' toast--auth' : ''}`}>
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
