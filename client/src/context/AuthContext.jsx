import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('dd_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('dd_token') || null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('dd_token')));

  const persistAuth = useCallback((newToken, newUser) => {
    localStorage.setItem('dd_token', newToken);
    localStorage.setItem('dd_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.setItem('dd_intro_seen', '1');
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem('dd_token')) {
      setLoading(false);
      return;
    }
    try {
      const res = await authAPI.me();
      sessionStorage.setItem('dd_intro_seen', '1');
      setUser(res.data.user);
      localStorage.setItem('dd_user', JSON.stringify(res.data.user));
    } catch {
      sessionStorage.setItem('dd_intro_seen', '1');
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    persistAuth(res.data.access_token, res.data.user);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await authAPI.register(payload);
    persistAuth(res.data.access_token, res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(token && user),
        login,
        register,
        logout,
        refreshMe,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
