import axios from 'axios';
import log from '../utils/logger';

const TOKEN_KEY = 'admin_token';

// The fallback must match the port the API actually listens on (5001),
// or a missing apps/admin/.env produces a bare "Network Error" that looks like
// the server is down when it is running perfectly well on another port.
const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  timeout: 60000, // Render free-tier cold starts can run 30-60s
  withCredentials: false,
});

// Set by AuthContext so a rejected session can be cleared from one place
// rather than in every page's error handling.
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;

    config.metadata = { startedAt: performance.now() };
    log.api(
      `→ ${config.method?.toUpperCase()} ${config.url}`,
      config.data ? { body: config.data } : undefined
    );
    return config;
  },
  (error) => {
    log.error('Request setup failed', error);
    return Promise.reject(error);
  }
);

adminApi.interceptors.response.use(
  (response) => {
    const ms = Math.round(performance.now() - (response.config.metadata?.startedAt || 0));
    log.api(
      `← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${ms}ms)`,
      response.data?.data !== undefined ? response.data.data : response.data
    );
    return response;
  },
  (error) => {
    const cfg = error.config || {};
    const ms = Math.round(performance.now() - (cfg.metadata?.startedAt || 0));
    const status = error.response?.status ?? '—';

    log.error(
      `← ${status} ${cfg.method?.toUpperCase?.() || ''} ${cfg.url || ''} (${ms}ms)`,
      error.response?.data || error.message
    );

    // Don't bounce the user out of a login attempt — a 401 there just
    // means wrong credentials, and the form shows its own message.
    const isLoginAttempt = cfg.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginAttempt) {
      onUnauthorized?.();
    }

    // No `response` at all means the request never reached the API —
    // axios reports this as a bare "Network Error" with no indication of
    // where it tried to go. In development, say so, because the usual
    // cause is a missing .env or a server that is not running.
    if (import.meta.env.DEV && !error.response) {
      console.error(
        `[adminApi] Could not reach ${adminApi.defaults.baseURL}${cfg.url || ''}\n` +
        '  • Is the API running?  npm run dev:server  (expect "Server running on port 5001")\n' +
        '  • Does apps/admin/.env exist, with VITE_API_URL=http://localhost:5001/api ?\n' +
        '  • Vite only reads .env at startup — restart it after creating or editing one.'
      );
    }

    return Promise.reject(error);
  }
);

export default adminApi;
