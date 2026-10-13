import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './routes/ProtectedRoute';
import EntryCurtain from './components/EntryCurtain/EntryCurtain';
import Home from './pages/Home/Home';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Toaster, TooltipProvider } from '@printlabs/ui';

// Home ships in the initial bundle since it is the landing route; every
// other page is fetched on demand.
const Shop = lazy(() => import('./pages/Shop/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail/ProductDetail'));
const Login = lazy(() => import('./pages/Login/Login'));
const Register = lazy(() => import('./pages/Register/Register'));
const Cart = lazy(() => import('./pages/Cart/Cart'));
const Checkout = lazy(() => import('./pages/Checkout/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess/OrderSuccess'));
const MyOrders = lazy(() => import('./pages/MyOrders/MyOrders'));
const Account = lazy(() => import('./pages/Account/Account'));
const AccountData = lazy(() => import('./pages/Account/AccountData'));
const AccountSecurity = lazy(() => import('./pages/Account/AccountSecurity'));
const Legal = lazy(() => import('./pages/Legal/Legal'));
const Newsletter = lazy(() => import('./pages/Newsletter/Newsletter'));
const Fabi = lazy(() => import('./components/Fabi/Fabi'));

const RouteFallback = () => <div className="route-loading">Loading...</div>;

/* Sign-in and registration are the only routes without the site chrome. */
const BARE_ROUTES = new Set(['/login', '/register']);

/**
 * The navigation bar, mounted once for the whole app.
 *
 * It used to be rendered inside each route element, which meant React
 * unmounted and rebuilt it on every navigation. That re-ran its scroll
 * listener, theme application and media-query subscription each time, and
 * it broke the active-tab indicator outright: the shared layout animation
 * needs the element to survive the route change in order to animate from
 * where it was to where it now belongs, and a remount left it stranded
 * mid-travel under the previous tab.
 *
 * Mounted here it simply persists, and the indicator animates.
 */
const Chrome = () => {
  const { pathname } = useLocation();
  if (BARE_ROUTES.has(pathname)) return null;
  return <Navbar />;
};

const withMain = (children) => <main>{children}</main>;

const withProtectedNav = (children, reason) => (
  <ProtectedRoute reason={reason}>{withMain(children)}</ProtectedRoute>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          {/* One tooltip context for the app, so hovering between two
              tooltipped controls does not replay the open delay, and one
              toast outlet, so async results are always reported somewhere
              rather than each screen inventing a place to put them. */}
          <TooltipProvider>
          <div className="app">
            <Chrome />
            {/* Mounted above the routes so the page it reveals is already
                rendered and interactive beneath it. */}
            <EntryCurtain />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={withMain(<Home />)} />
                <Route path="/shop" element={withMain(<Shop />)} />
                <Route path="/product/:id" element={withMain(<ProductDetail />)} />
                <Route path="/cart" element={withMain(<Cart />)} />

                {/* The catalogue is open to everyone; the newsletter is
                    account-only, so an anonymous visitor is sent to sign
                    in and returned here afterwards. */}
                <Route
                  path="/newsletter"
                  element={withProtectedNav(<Newsletter />, 'read the newsletter')}
                />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route path="/checkout" element={withProtectedNav(<Checkout />)} />
                <Route path="/order-success" element={withProtectedNav(<OrderSuccess />)} />
                <Route path="/my-orders" element={withProtectedNav(<MyOrders />)} />
                <Route path="/account" element={withProtectedNav(<Account key="profile" />)} />
                <Route path="/account/address" element={withProtectedNav(<Account key="address" addressOnly />)} />
                <Route path="/account/security" element={withProtectedNav(<AccountSecurity />)} />
                <Route path="/account/data" element={withProtectedNav(<AccountData />, 'download your account data')} />
                <Route path="/privacy" element={withMain(<Legal type="privacy" />)} />
                <Route path="/terms" element={withMain(<Legal type="terms" />)} />
              </Routes>
            </Suspense>
            <Suspense fallback={null}>
              <Fabi />
            </Suspense>
            {/* Cleared of the Fabi launcher, which is fixed to the same
                corner (62px tall at a 2rem inset, 1rem on small screens).
                Without this the first toast lands on top of it and covers
                the control the visitor may be reaching for. */}
            <Toaster
              offset={{ bottom: '7rem', right: '2rem' }}
              mobileOffset={{ bottom: '6rem', left: '1rem', right: '1rem' }}
            />
          </div>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
