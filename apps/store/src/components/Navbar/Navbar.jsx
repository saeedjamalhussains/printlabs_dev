import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, User } from 'lucide-react';
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { transitions } from '@printlabs/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import logoLight from '@brand/logo_light.png';
import logoDark from '@brand/logo_dark.png';
import { ThemedImage } from '@printlabs/ui';
import './Navbar.css';

/* The primary destinations, as data. Declaring them here rather than as
   three hand-written links keeps the indicator markup identical for every
   tab — the underline is shared, so any difference between them would
   show up as a jump mid-travel. */
const NAV_TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/newsletter', label: 'Newsletter' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const reducedMotion = useReducedMotion();
  const { pathname } = useLocation();

  /* ── Active-tab indicator ──────────────────────────────────────────
     One underline that lives in the tab strip permanently and slides to
     sit under whichever tab is current.

     The idiomatic Motion version of this is a shared `layoutId` on an
     element rendered inside whichever tab is active, which is what the
     motion.dev tab-select example does. This measures the geometry
     explicitly instead, for two reasons that outlast the animation:

       - it can say "no tab is current". On /cart or /account nothing in
         the strip is the active page, and an underline is better absent
         than parked under whichever tab it last belonged to.
       - it re-measures on resize and on webfont load, so the rule still
         matches the word after the tabs change width underneath it.

     Only x and scaleX are animated, both compositor properties, so the
     indicator never reflows the bar as it travels. The element is 1px
     wide and scaled to the width of the tab, which is why scaleX is given
     a real pixel width rather than a ratio. */
  const tabStripRef = useRef(null);
  const tabRefs = useRef(new Map());
  const [indicator, setIndicator] = useState(null);

  const measureIndicator = useCallback(() => {
    const strip = tabStripRef.current;
    const active = tabRefs.current.get(pathname);
    if (!strip || !active) {
      // No tab matches the current route (cart, account, an order page).
      // The underline is hidden rather than left pointing somewhere
      // arbitrary — nothing in the bar is current, and saying so is
      // correct.
      setIndicator(null);
      return;
    }
    const stripBox = strip.getBoundingClientRect();
    const tabBox = active.getBoundingClientRect();
    setIndicator({
      // Trailing letterspace trimmed, so the rule matches the word rather
      // than the box the word sits in.
      x: tabBox.left - stripBox.left,
      width: Math.max(tabBox.width - 4, 8),
    });
  }, [pathname]);

  // Layout effect so the first paint already has it in the right place;
  // measuring in a passive effect shows one frame of the underline at
  // zero before it jumps.
  useLayoutEffect(() => { measureIndicator(); }, [measureIndicator]);

  // Re-measure when the strip changes size: a viewport resize, a font
  // finishing loading, or the reader changing their text size all move
  // the tabs out from under it.
  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureIndicator);
    observer.observe(strip);
    document.fonts?.ready?.then(measureIndicator).catch(() => {});
    return () => observer.disconnect();
  }, [measureIndicator]);
  const { totalItems } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Scroll handler to toggle scrolled state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the dropdown menu when clicking outside of it.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically hide the dropdown menu after six seconds, and close it when
  // the Escape key is pressed.
  useEffect(() => {
    if (!isDropdownOpen) return;
    const timeout = setTimeout(() => setIsDropdownOpen(false), 6000);
    const onKey = (e) => { if (e.key === 'Escape') setIsDropdownOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('keydown', onKey);
    };
  }, [isDropdownOpen]);



  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-content">
        <Link to="/" className="logo" onClick={() => setIsOpen(false)}>
          {/* Light scheme takes the dark mark, and vice versa. */}
          <ThemedImage
            srcLight={logoDark}
            srcDark={logoLight}
            alt="ThePrintLabs"
            className="nav-logo-img"
          />
          <div className="logo-text">
            The<br />Print<br />Labs.
          </div>
        </Link>

        <div className={`nav-links ${isOpen ? 'open' : ''}`} ref={tabStripRef}>
          {NAV_TABS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              ref={(node) => {
                if (node) tabRefs.current.set(to, node);
                else tabRefs.current.delete(to);
              }}
              onClick={() => setIsOpen(false)}
            >
              {label}
            </NavLink>
          ))}

          {/* Rendered once and moved, rather than mounted inside whichever
              tab is active — see the note on measureIndicator. */}
          {indicator && (
            <motion.span
              className="nav-active-indicator"
              aria-hidden="true"
              initial={false}
              animate={{ x: indicator.x, scaleX: indicator.width }}
              transition={reducedMotion ? { duration: 0 } : transitions.nav}
            />
          )}

          <Link to="/cart" className="mobile-cart-link" onClick={() => setIsOpen(false)}>
            Cart {totalItems > 0 && `(${totalItems})`}
          </Link>
        </div>

        <div className="nav-actions">
          {user ? (
            <div className="user-dropdown-container" ref={dropdownRef}>
              {/* The account control is an icon at every width now. The
                  name was set in the same letterspaced capitals as the
                  nav links, which made even a short one wide and a long
                  one ellipsize to something unreadable — "SAEED JAMAL
                  HUSSAI…" told nobody anything while occupying more of
                  the bar than the navigation did.

                  The name has not been thrown away: it moves inside the
                  menu, where it has room to be read in full, and it is
                  the button's accessible name so screen-reader users
                  still hear whose account this is. */}
              <button
                type="button"
                className="user-name-toggle"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-label={`Account menu for ${user.name}`}
                aria-haspopup="menu"
                aria-expanded={isDropdownOpen}
              >
                <User size={20} aria-hidden="true" />
              </button>
              {isDropdownOpen && (
                <div className="user-dropdown-menu">
                  {/* Who you are signed in as, stated once, in full. */}
                  <div className="dropdown-identity">
                    <span className="dropdown-identity-name">{user.name}</span>
                    {user.email && (
                      <span className="dropdown-identity-email">{user.email}</span>
                    )}
                  </div>
                  <Link
                    to="/account"
                    className="dropdown-link"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Account
                  </Link>
                  <Link
                    to="/my-orders"
                    className="dropdown-link"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    My Orders
                  </Link>
                  <button onClick={handleLogout} className="dropdown-item">
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/register" className="btn-primary" onClick={() => setIsOpen(false)}>Sign Up</Link>
          )}
          
          <Link to="/cart" className="cart-icon" onClick={() => setIsOpen(false)}>
            <ShoppingCart size={24} />
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </Link>

          <button className="menu-toggle" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
