import axios from 'axios';

const api = axios.create({
  // Must match the port the API actually listens on (5001). A stale
  // fallback here surfaces as a bare "Network Error" with no clue that
  // the cause is a missing client/.env.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  // Render free tier cold-starts can run 30-60s. A 60s timeout keeps
  // the first /auth/me request alive instead of orphaning the token.
  timeout: 60000,
  // We use Authorization-header tokens stored in localStorage rather
  // than cookies, so credentials aren't needed. Sending them forces a
  // stricter CORS contract for no benefit.
  withCredentials: false,
});

// Registered by AuthContext so an expired or revoked session is cleared
// in one place instead of being re-discovered by every page.
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // A 401 means the token is expired or was invalidated server-side (a
    // password change, role change or suspension bumps tokenVersion).
    // Sign-in and registration are excluded — a 401 there is just bad
    // credentials, and those forms surface their own message.
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    const isWrongCurrentPassword = url === '/auth/me/password' &&
      error.response?.data?.code === 'INVALID_CREDENTIALS';
    if (status === 401 && !isAuthAttempt && !isWrongCurrentPassword) {
      onUnauthorized?.();
    }

    // Canceled requests also have no response; don't misreport React
    // Strict Mode's development-only effect cleanup as an API outage.
    if (import.meta.env.DEV && !error.response && !axios.isCancel(error)) {
      console.error(
        `[api] Could not reach ${api.defaults.baseURL}${url}\n` +
        '  • Is the API running?  npm run dev:server  (expect "Server running on port 5001")\n' +
        '  • Does client/.env exist, with VITE_API_URL=http://localhost:5001/api ?\n' +
        '  • Vite only reads .env at startup — restart it after creating or editing one.'
      );
    }

    return Promise.reject(error);
  }
);

export default api;
