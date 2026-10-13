import { useEffect, useMemo, useState, useCallback } from 'react';
import api, { setUnauthorizedHandler } from '../services/adminApi';
import log from '../utils/logger';
import { AuthContext } from '../hooks/useAuth';

const TOKEN_KEY = 'admin_token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // A 401 from any endpoint means the token is gone, expired, or was
  // invalidated server-side (password change, role change, suspension).
  // Drop it immediately rather than letting every subsequent call fail.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      log.error('Session rejected by server — signing out');
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    const restore = async () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        const me = data.data.user;
        // The dashboard is admin-only; a valid customer token must not
        // open it even though the token itself is genuine.
        if (me?.role !== 'admin') {
          clearSession();
        } else {
          setUser(me);
        }
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const session = data.data;

    if (session?.role !== 'admin') {
      throw new Error('This account does not have admin access.');
    }
    localStorage.setItem(TOKEN_KEY, session.token);
    setUser(session);
    log.action('Admin signed in', { email: session.email });
    return session;
  }, []);

  const logout = useCallback(() => {
    log.action('Admin signed out');
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
