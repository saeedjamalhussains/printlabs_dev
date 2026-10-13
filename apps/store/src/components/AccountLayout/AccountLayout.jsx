import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowUpRight, UserRound, MapPin, Package, Shield, Download, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import '../../pages/Account/Account.css';

const links = [
  ['/account', 'Personal details', UserRound],
  ['/account/address', 'Delivery address', MapPin],
  ['/my-orders', 'My orders', Package],
  ['/account/security', 'Password & security', Shield],
  ['/account/data', 'Your data', Download],
];

export default function AccountLayout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || 'You').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('');
  return (
    <div className="account-page container">
      <div className="account-topline"><span>Your space at ThePrintLabs</span><Link to="/shop">Back to the shop <ArrowUpRight size={14} /></Link></div>
      <div className="account-layout">
        <aside className="account-sidebar">
          <div className="account-identity"><span className="account-avatar" aria-hidden="true">{initials}</span><div><p>{user?.name || 'Your account'}</p><span>{user?.email}</span></div></div>
          <nav aria-label="Account" className="account-nav">
            {links.map(([to, label, Icon]) => <NavLink key={to} to={to} end className={({ isActive }) => `account-nav-link${isActive ? ' is-active' : ''}`}><Icon size={17} aria-hidden="true" />{label}</NavLink>)}
          </nav>
          <div className="account-sidebar-bottom"><span className="account-eyebrow">Good to know</span><Link to="/newsletter">News & new drops <ArrowUpRight size={13} /></Link><Link to="/privacy">Privacy policy <ArrowUpRight size={13} /></Link><Link to="/terms">Terms & conditions <ArrowUpRight size={13} /></Link></div>
          <button className="account-logout" onClick={() => { logout(); navigate('/'); }}><LogOut size={16} />Sign out</button>
        </aside>
        <div className="account-main"><header className="account-heading"><p className="account-eyebrow">My account</p><h1>{title}</h1><p>{subtitle}</p></header>{children}<p className="account-footnote">Made for your walls. Kept simple for you.</p></div>
      </div>
    </div>
  );
}
