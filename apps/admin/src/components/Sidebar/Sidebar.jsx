import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Cloud,
  Mail,
  Tag,
  ScrollText,
  LogOut,
} from 'lucide-react';
import log from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';
import logoDark from '@brand/logo_dark.png';
import logoLight from '@brand/logo_light.png';
import { ThemedImage } from '@printlabs/ui';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/coupons', icon: Tag, label: 'Coupons' },
  { to: '/newsletter', icon: Mail, label: 'Newsletter' },
  { to: '/cloudinary', icon: Cloud, label: 'Cloudinary' },
  { to: '/audit', icon: ScrollText, label: 'Audit Trail' },
];

const Sidebar = ({ isOpen = false, onNavigate }) => {
  const { user, logout } = useAuth();

  // Sync dark mode state with document classes and localStorage.


  const handleNavClick = (to, label) => {
    log.nav(`→ ${label}`, { to });
    onNavigate?.();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <ThemedImage
            srcLight={logoDark}
            srcDark={logoLight}
            alt="ThePrintLabs"
            className="sidebar-logo-img"
          />
          <div className="sidebar-logo-text">
            The<br />Print<br />Labs.
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => handleNavClick(item.to, item.label)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user" title={user.email}>
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-email">{user.email}</span>
          </div>
        )}
        <div className="sidebar-actions">
          <button
            className="sidebar-action-btn"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
