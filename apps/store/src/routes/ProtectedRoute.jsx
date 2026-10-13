import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * @param {string} [reason] What the visitor was trying to reach, phrased
 *        to complete "You need an account to …". Shown on the sign-in
 *        screen so an unexpected redirect explains itself.
 */
const ProtectedRoute = ({ children, reason }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location, reason }} replace />;
  }

  return children;
};

export default ProtectedRoute;
