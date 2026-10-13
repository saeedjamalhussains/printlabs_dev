import { useState, useEffect } from 'react';
import { IndianRupee, ShoppingCart, Package, Users, ShieldCheck, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import api from '../../services/adminApi';
import './Dashboard.css';

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data } = await api.get('/admin/analytics');
        setAnalytics(data.data);
      } catch (error) {
        const msg = error.response?.data?.message || 'Failed to load analytics.';
        alert(msg);
        console.error('Analytics load error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!analytics) return <div className="empty-state"><h3>Failed to load analytics.</h3></div>;

  const revenueChange = analytics.revenue.lastMonth > 0
    ? ((analytics.revenue.thisMonth - analytics.revenue.lastMonth) / analytics.revenue.lastMonth * 100).toFixed(1)
    : analytics.revenue.thisMonth > 0 ? 100 : 0;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Revenue</span>
            <IndianRupee size={18} className="stat-icon" />
          </div>
          <div className="stat-value">₹{analytics.revenue.total.toLocaleString()}</div>
          <div className={`stat-change ${revenueChange >= 0 ? 'positive' : 'negative'}`}>
            {revenueChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            &nbsp;{Math.abs(revenueChange)}% from last month
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Orders</span>
            <ShoppingCart size={18} className="stat-icon" />
          </div>
          <div className="stat-value">{analytics.orders.total}</div>
          <div className="stat-change">
            {analytics.orders.byStatus.placed || 0} pending
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Products</span>
            <Package size={18} className="stat-icon" />
          </div>
          <div className="stat-value">{analytics.products.total}</div>
          <div className={`stat-change ${analytics.products.lowStock.length > 0 ? 'negative' : ''}`}>
            {analytics.products.lowStock.length} low stock
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Customers</span>
            <Users size={18} className="stat-icon" />
          </div>
          <div className="stat-value">{analytics.users.customers ?? 0}</div>
          <div className="stat-change positive">
            +{analytics.users.newCustomersThisMonth ?? 0} this month
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Admins</span>
            <ShieldCheck size={18} className="stat-icon" />
          </div>
          <div className="stat-value">{analytics.users.team ?? 0}</div>
          <div className="stat-change">
            {analytics.users.newTeamThisMonth ?? 0} added this month
          </div>
        </div>
      </div>

      {/* User Role Breakdown */}
      {analytics.users.byRole && (
        <div className="dashboard-section">
          <h2>People Breakdown</h2>
          <div className="status-breakdown">
            <div className="status-item">
              <span className="badge badge-active">Customers</span>
              <span className="status-count">{analytics.users.byRole.customer}</span>
            </div>
            <div className="status-item">
              <span className="badge badge-confirmed">Admin</span>
              <span className="status-count">{analytics.users.byRole.admin}</span>
            </div>
          </div>
        </div>
      )}

      {/* Order Status Breakdown */}
      <div className="dashboard-section">
        <h2>Order Status</h2>
        <div className="status-breakdown">
          {Object.entries(analytics.orders.byStatus).map(([status, count]) => (
            <div key={status} className="status-item">
              <span className={`badge badge-${status}`}>{status}</span>
              <span className="status-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="dashboard-section">
        <h2>Recent Orders</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentOrders.map((order) => (
                <tr key={order._id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {order._id.slice(-8).toUpperCase()}
                  </td>
                  <td>{order.user?.name || 'Unknown'}</td>
                  <td>₹{order.totalAmount.toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${order.orderStatus}`}>
                      {order.orderStatus}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Alert */}
      {analytics.products.lowStock.length > 0 && (
        <div className="dashboard-section">
          <h2><AlertTriangle size={18} /> Low Stock Alert</h2>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Remaining Stock</th>
                </tr>
              </thead>
              <tbody>
                {analytics.products.lowStock.map((p) => (
                  <tr key={p._id}>
                    <td>{p.title}</td>
                    <td>
                      <span className="badge badge-cancelled">{p.stock} left</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
