import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE = '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ikhwezi_token'));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchWithAuth = useCallback(async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    
    return response;
  }, [token]);

  const fetchMe = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetchWithAuth('/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        localStorage.removeItem('ikhwezi_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token, fetchWithAuth]);

  const createGuestSession = useCallback(async () => {
    try {
      const guestUsername = `guest_${Math.random().toString(36).substring(7)}`;
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: guestUsername,
          password: 'guest_password_' + Math.random(),
          email: `${guestUsername}@guest.local`,
          displayName: 'Guest User'
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('ikhwezi_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setIsGuest(true);
      }
    } catch (err) {
      console.error('Guest session creation failed:', err);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      createGuestSession();
    }
  }, []);

  const login = async (credentials) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
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
      showToast('Welcome back!', 'success');
      return { success: true };
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
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
    showToast('Logged out', 'success');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isGuest,
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
