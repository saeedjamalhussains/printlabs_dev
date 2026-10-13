import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Gate an action behind having an account.
 *
 * Browsing stays open to everyone; anything that acts on the store —
 * adding to the cart, subscribing — needs a signed-in user. This is the
 * one place that decision is made, so a new gated action cannot end up
 * with its own slightly different redirect.
 *
 * The current location travels in `state.from`, which Login and Register
 * already read, so the customer lands back where they were rather than
 * on the home page. `reason` is shown on the sign-in screen so the
 * redirect never looks arbitrary.
 *
 * @returns {(reason?: string) => boolean} true when the caller may
 *          proceed; false once the redirect has been started.
 */
export const useRequireAuth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (reason) => {
    if (user) return true;
    navigate('/login', { state: { from: location, reason } });
    return false;
  };
};

export default useRequireAuth;
