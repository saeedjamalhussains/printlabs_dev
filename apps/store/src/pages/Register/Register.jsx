import { useEffect, useRef, useState } from 'react';
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

// Must match the server's rule in authController.register. These were out
// of sync: the form accepted 6 characters and the API rejected anything
// under 8, so the failure only surfaced after the user had filled in both
// steps — the most expensive possible moment to be told.
const MIN_PASSWORD = 8;

const StepDots = ({ step }) => (
  <div className="auth-steps" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={2} aria-label={`Step ${step} of 2`}>
    <span className={`auth-step ${step === 1 ? 'active' : 'done'}`} />
    <span className={`auth-step ${step === 2 ? 'active' : ''}`} />
  </div>
);

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    street: '', city: '', state: '', pincode: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const leavePage = useAuthBack();
  const cardRef = useRef(null);

  // Moving between steps swaps the whole form out. Without this the user
  // lands mid-page on the new step, still scrolled to where the old one
  // ended — especially disorienting on a phone.
  useEffect(() => {
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user starts correcting it,
    // rather than leaving stale red text until the next submit.
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validateStepOne = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Please enter your name.';
    if (!formData.email.trim()) errors.email = 'Please enter your email.';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) errors.email = 'That does not look like a valid email.';
    if (!formData.password) errors.password = 'Please choose a password.';
    else if (formData.password.length < MIN_PASSWORD) {
      errors.password = `Password must be at least ${MIN_PASSWORD} characters.`;
    }
    if (!formData.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    return errors;
  };

  const handleContinue = (e) => {
    e.preventDefault();
    setError('');

    const errors = validateStepOne();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStep(2);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    const errors = {};
    if (!formData.street.trim()) errors.street = 'Street address is required.';
    if (!formData.city.trim()) errors.city = 'City is required.';
    if (!/^\d{6}$/.test(formData.pincode.trim())) errors.pincode = 'Enter a 6-digit pincode.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.phone,
        {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        }
      );
      // Same one-shot marker as sign-in — see entryTransition.
      markAuthenticatedEntry();
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      setLoading(false);

      // An email clash or a password the server rejects both belong to
      // step 1 — send the user back to the field they can actually fix.
      if (/email/i.test(message) || /password/i.test(message)) {
        setStep(1);
        setFieldErrors(/email/i.test(message) ? { email: message } : { password: message });
      }
    }
  };

  return (
    <div className="auth-page container">
      <div className="auth-card" ref={cardRef}>
        {/* Only on step 1. Step 2 already has its own "← Back" beneath
            the form, which returns to step 1 — showing a second control
            here, also labelled Back but leaving the page entirely, would
            make neither one predictable. */}
        {step === 1 && (
          <button type="button" className="auth-exit" onClick={leavePage}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back</span>
          </button>
        )}

        {/* The aside/main split is what turns the card landscape on tablets
            and desktops. Below that width both panels are `display: contents`,
            so the children flow as one column exactly as before. */}
        <div className="auth-aside">
          <Link to="/" className="auth-logo-link" aria-label="Back to ThePrintLabs">
            <ThemedImage srcLight={logoDark} srcDark={logoLight} alt="ThePrintLabs" className="auth-logo" />
          </Link>

          <StepDots step={step} />

          {step === 1 ? (
            <>
              <p className="auth-eyebrow">Begin</p>
              <h1 className="auth-title">Make an account.</h1>
              <p className="auth-subtitle">Join us. It takes a minute.</p>
            </>
          ) : (
            <>
              <p className="auth-eyebrow">Onboarding</p>
              <h1 className="auth-title">Your address.</h1>
              <p className="auth-subtitle">Where should we deliver your posters?</p>
            </>
          )}
        </div>

        <div className="auth-main">
          <hr className="auth-rule" aria-hidden="true" />

          {/* Carried through from the gated action, and preserved when
              switching between Sign in and Create account. */}
          {location.state?.reason && (
            <div className="auth-notice">You need an account to {location.state.reason}.</div>
          )}

          {error && <div className="auth-error" role="alert">{error}</div>}

          {step === 1 ? (
            <>

            <form className="auth-form" onSubmit={handleContinue} noValidate>
              <div className={`auth-field ${fieldErrors.name ? 'has-error' : ''}`}>
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name" name="name" type="text" placeholder="Jane Doe"
                  value={formData.name} onChange={handleChange}
                  autoComplete="name" autoFocus
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && <p className="auth-field-error">{fieldErrors.name}</p>}
              </div>

              <div className={`auth-field ${fieldErrors.email ? 'has-error' : ''}`}>
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email" name="email" type="email" placeholder="name@example.com"
                  value={formData.email} onChange={handleChange}
                  autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck="false"
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && <p className="auth-field-error">{fieldErrors.email}</p>}
              </div>

              <div className="auth-field">
                <label htmlFor="reg-phone">Phone</label>
                <input
                  id="reg-phone" name="phone" type="tel" placeholder="+91 ..."
                  value={formData.phone} onChange={handleChange}
                  autoComplete="tel" inputMode="tel"
                />
              </div>

              <PasswordField
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                hint={`At least ${MIN_PASSWORD} characters.`}
                error={fieldErrors.password}
              />

              <PasswordField
                label="Confirm Password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
              />

              <button type="submit" className="auth-submit">
                <span>Continue</span> <ArrowRight size={14} />
              </button>
            </form>

            <nav className="auth-legal" aria-label="Policies"><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms &amp; conditions</Link></nav>
            <p className="auth-footer">
              Already have an account?
              <Link to="/login" state={location.state}>Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <form className="auth-form" onSubmit={handleCreate} noValidate>
              <div className={`auth-field ${fieldErrors.street ? 'has-error' : ''}`}>
                <label htmlFor="reg-street">Street Address</label>
                <input
                  id="reg-street" name="street" type="text"
                  placeholder="Flat, House no., Apartment, Street"
                  value={formData.street} onChange={handleChange}
                  autoComplete="street-address" autoFocus
                  aria-invalid={Boolean(fieldErrors.street)}
                />
                {fieldErrors.street && <p className="auth-field-error">{fieldErrors.street}</p>}
              </div>

              <div className="auth-row">
                <div className={`auth-field ${fieldErrors.city ? 'has-error' : ''}`}>
                  <label htmlFor="reg-city">City</label>
                  <input
                    id="reg-city" name="city" type="text" placeholder="New Delhi"
                    value={formData.city} onChange={handleChange}
                    autoComplete="address-level2"
                    aria-invalid={Boolean(fieldErrors.city)}
                  />
                  {fieldErrors.city && <p className="auth-field-error">{fieldErrors.city}</p>}
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-state">State <span style={{ opacity: 0.5 }}>(optional)</span></label>
                  <input
                    id="reg-state" name="state" type="text" placeholder="Delhi"
                    value={formData.state} onChange={handleChange}
                    autoComplete="address-level1"
                  />
                </div>
              </div>

              <div className={`auth-field ${fieldErrors.pincode ? 'has-error' : ''}`}>
                <label htmlFor="reg-pincode">Pincode</label>
                <input
                  id="reg-pincode" name="pincode" type="text" placeholder="110001"
                  value={formData.pincode} onChange={handleChange}
                  autoComplete="postal-code"
                  // Numeric keypad on mobile without losing leading zeros.
                  inputMode="numeric" maxLength={6}
                  aria-invalid={Boolean(fieldErrors.pincode)}
                />
                {fieldErrors.pincode && <p className="auth-field-error">{fieldErrors.pincode}</p>}
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={14} className="auth-spinner" /> <span>Creating…</span>
                  </>
                ) : (
                  <>
                    <span>Create account</span> <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              className="auth-back"
              onClick={() => { setStep(1); setError(''); }}
              disabled={loading}
            >
              ← Back
            </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
