import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import logoDark from '@brand/logo_dark.png';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      // No navigation needed — AuthProvider flipping `user` swaps the
      // whole route tree over to the dashboard.
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Sign-in failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <img src={logoDark} alt="ThePrintLabs" className="admin-login-logo" />
        <h1 className="admin-login-title">Admin Panel</h1>
        <p className="admin-login-sub">
          <Lock size={12} /> Authorized personnel only
        </p>

        {error && <div className="admin-login-error">{error}</div>}

        <label className="admin-login-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="admin-login-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="admin-login-btn" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={16} className="admin-login-spinner" /> Signing in…
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;
