import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input with a reveal toggle and a caps-lock warning.
 *
 * Both were missing entirely: there was no way to check a typed password
 * before submitting, and caps lock is the single most common cause of a
 * "wrong password" that is not actually wrong.
 */
const PasswordField = ({
  label,
  name,
  value,
  onChange,
  autoComplete = 'current-password',
  error,
  hint,
  required = true,
  autoFocus = false,
}) => {
  const [revealed, setRevealed] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const id = useId();
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`, capsLock && `${id}-caps`]
    .filter(Boolean)
    .join(' ');

  const trackCapsLock = (e) => {
    // getModifierState is undefined on some synthetic events; guard it.
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>

      <div className="auth-input-wrap">
        <input
          id={id}
          name={name}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onKeyUp={trackCapsLock}
          onKeyDown={trackCapsLock}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="auth-reveal"
          onClick={() => setRevealed((r) => !r)}
          // The toggle is a convenience, not a stop on the way to the
          // submit button — keep it out of the tab order.
          tabIndex={-1}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          title={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {capsLock && (
        <p id={`${id}-caps`} className="auth-field-note">
          Caps Lock is on.
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="auth-field-note">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="auth-field-error">
          {error}
        </p>
      )}
    </div>
  );
};

export default PasswordField;
