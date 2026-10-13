import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import AdminLayout from './components/AdminLayout/AdminLayout';
import Login from './pages/Login/Login';
import { Toaster, TooltipProvider } from '@printlabs/ui';

// Dashboard pages are split per route: the sign-in screen no longer ships
// the Cloudinary browser, the coupon editor and every table alongside it.
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Products = lazy(() => import('./pages/Products/Products'));
const Orders = lazy(() => import('./pages/Orders/Orders'));
const Users = lazy(() => import('./pages/Users/Users'));
const Cloudinary = lazy(() => import('./pages/Cloudinary/Cloudinary'));
const Newsletter = lazy(() => import('./pages/Newsletter/Newsletter'));
const Coupons = lazy(() => import('./pages/Coupons/Coupons'));
const Audit = lazy(() => import('./pages/Audit/Audit'));

const RouteFallback = () => <div className="admin-route-loading">Loading…</div>;

/**
 * Gate for the whole dashboard. While the stored token is being checked
 * nothing is rendered but a placeholder — showing the dashboard first and
 * redirecting afterwards would flash real data at a signed-out viewer.
 */
const Gate = () => {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback />;
  if (!user) return <Login />;

  return (
    <AdminLayout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />

          {/* Products, orders and users are managed inline on their list
              pages — there are no detail routes. Anything else falls
              through to the catch-all redirect below rather than
              rendering an empty page. */}
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/users" element={<Users />} />

          <Route path="/coupons" element={<Coupons />} />
          <Route path="/cloudinary" element={<Cloudinary />} />
          <Route path="/newsletter" element={<Newsletter />} />
          <Route path="/audit" element={<Audit />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* Shared tooltip and toast context for the dashboard — see the
            storefront App for the reasoning. */}
        <TooltipProvider>
          <Gate />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
