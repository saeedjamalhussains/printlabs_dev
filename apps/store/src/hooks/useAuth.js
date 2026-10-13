import { createContext, useContext } from 'react';

/**
 * The auth context object lives here rather than beside the provider so
 * that AuthContext.jsx exports a component and nothing else — a file
 * mixing components with other exports breaks Fast Refresh, which is why
 * eslint flags it.
 *
 * There is no circular import: this module knows about the context, and
 * the provider imports it, but never the other way round.
 */
export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
