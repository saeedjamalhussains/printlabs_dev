import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Where "back" should go from the sign-in and registration screens.
 *
 * These pages are reached three different ways, and a plain link to "/"
 * is wrong for two of them:
 *
 *   1. Redirected mid-action (clicking Add to Cart while signed out).
 *      `state.from` holds the page they were on — return them there, so
 *      backing out lands where they started rather than on the homepage.
 *   2. Navigated from inside the app (the Sign Up button in the navbar).
 *      Step back through history.
 *   3. Opened directly, by typed URL or a bookmark. There is no in-app
 *      history to step back through, and navigate(-1) would leave the
 *      site entirely. Go home instead.
 *
 * React Router stamps an `idx` onto history state, which is how case 3
 * is told apart from case 2: idx 0 means this is the first entry in the
 * session, so there is nothing of ours behind it.
 */
export const useAuthBack = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    const from = location.state?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate('/');
  };
};

export default useAuthBack;
