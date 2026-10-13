import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import PasswordField from '../../components/PasswordField/PasswordField';
import { useAuthBack } from '../../hooks/useAuthBack';
import logoLight from '../../assets/logo_light.png';
import { ThemedImage } from '@printlabs/ui';
import logoDark from '../../assets/logo_dark.png';
import '../../styles/auth.css';
import { markAuthenticatedEntry } from '../../utils/entryTransition';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';
  const reason = location.state?.reason;
  const goBack = useAuthBack();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Marks the navigation that follows as an entrance into the
      // product, so the reveal plays once if it lands on the home page.
      // Cleared as soon as it is read, so a refresh cannot replay it.
      markAuthenticatedEntry();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to sign in.');
      // Only stop the spinner on failure — on success this component
      // unmounts during navigation, and setting state after that warns.
      setLoading(false);
    }
  };

  return (
    <div className="auth-page container">
      {/* The aside/main split is what turns the card landscape on tablets
          and desktops. Below that width both panels are `display: contents`,
          so the children flow as one column exactly as before. */}
      <div className="auth-card">
        <button type="button" className="auth-exit" onClick={goBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back</span>
        </button>

        <div className="auth-aside">
          <Link to="/" className="auth-logo-link" aria-label="Back to ThePrintLabs">
            <ThemedImage srcLight={logoDark} srcDark={logoLight} alt="ThePrintLabs" className="auth-logo" />
          </Link>

          <p className="auth-eyebrow">Welcome back</p>
          <h1 className="auth-title">Sign in.</h1>
          <p className="auth-subtitle">Pick up where you left off.</p>
        </div>

        <div className="auth-main">
          <hr className="auth-rule" aria-hidden="true" />

          {/* Set when the visitor was redirected here mid-action. Without
              it, being bounced to a sign-in screen for clicking "Add to
              Cart" reads as the site malfunctioning. */}
          {reason && (
            <div className="auth-notice">You need an account to {reason}.</div>
          )}

          {/* role="alert" so a screen reader announces the failure instead
              of leaving the user waiting on a silent form. */}
          {error && <div className="auth-error" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                name="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                // Lets a password manager recognise and fill the pair.
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck="false"
                autoFocus
                required
              />
            </div>

            <PasswordField
              label="Password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={14} className="auth-spinner" /> <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span> <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <nav className="auth-legal" aria-label="Policies"><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms &amp; conditions</Link></nav>
            <p className="auth-footer">
            New here?
            <Link to="/register" state={location.state}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
