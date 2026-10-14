import { createContext, useContext } from 'react';

/**
 * The auth context object lives here rather than beside the provider so
 * that AuthContext.jsx exports a component and nothing else — a file
 * mixing components with other exports breaks Fast Refresh, which is why
 * eslint flags it.
 *
 * Mirrors apps/store/src/hooks/useAuth.js; the two apps keep separate auth
 * because they hold separate tokens.
 */
export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
