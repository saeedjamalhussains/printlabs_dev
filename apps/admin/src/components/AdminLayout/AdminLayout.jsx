import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';

const AdminLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      <button
        type="button"
        className="admin-mobile-toggle"
        onClick={() => setIsSidebarOpen((open) => !open)}
        aria-label="Toggle admin navigation"
      >
        {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {isSidebarOpen && <div className="admin-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
      <div className="admin-main">
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;