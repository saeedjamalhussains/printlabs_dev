import { useEffect, useState, useCallback } from 'react';
import api, { setUnauthorizedHandler } from '../services/api';
import { AuthContext } from '../hooks/useAuth';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  // The API layer reports a rejected session once; the previous behaviour
  // left an invalid token in localStorage until the user happened to hit
  // another failing request.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    const fetchMe = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.data.user);
        } catch (err) {
          console.debug('Token validation failed:', err?.response?.status);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    fetchMe();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const session = data.data;
    if (session?.token) {
      localStorage.setItem('token', session.token);
      setUser(session);
      return session;
    }
    throw new Error('Unexpected login response');
  };

  const register = async (name, email, password, phone, address) => {
    const { data } = await api.post('/auth/register', { name, email, password, phone, address });
    const session = data.data;
    if (session?.token) {
      localStorage.setItem('token', session.token);
      setUser(session);
    }
    return session;
  };

  const updateSession = (session) => {
    if (session?.token) localStorage.setItem('token', session.token);
    setUser(previous => ({ ...previous, ...session }));
  };

  const logout = clearSession;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateSession }}>
      {children}
    </AuthContext.Provider>
  );
};
