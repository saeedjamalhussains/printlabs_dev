import { useState, useEffect } from 'react';
import { Users as UsersIcon, Shield, ShieldOff, Trash2 } from 'lucide-react';
import api from '../../services/adminApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import Pagination from '../../components/Pagination/Pagination';
import Dropdown from '../../components/Dropdown/Dropdown';
import log from '../../utils/logger';
import './Users.css';

const roleOptions = ['customer', 'admin'];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const fetchUsers = async (targetPage = page) => {
    try {
      const { data } = await api.get('/admin/users', { params: { page: targetPage } });
      setUsers(data.data.users);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch, not a cascading render
  useEffect(() => { fetchUsers(page); }, [page]);

  const handleRoleChange = async (userId, newRole) => {
    const prev = users.find((u) => u._id === userId)?.role;
    log.action('Role change requested', { userId, from: prev, to: newRole });
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      log.action('Role updated', { userId, role: newRole });
      fetchUsers(page);
    } catch (error) {
      log.error('Role update failed', { userId, error: error?.response?.data?.message });
      alert(error.response?.data?.message || 'Failed to update role.');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const next = !currentStatus;
    log.action(`User ${next ? 'enable' : 'disable'} requested`, { userId });
    try {
      await api.put(`/admin/users/${userId}/status`, { isActive: next });
      log.action(`User ${next ? 'enabled' : 'disabled'}`, { userId });
      fetchUsers(page);
    } catch (error) {
      log.error('Status toggle failed', { userId, error: error?.response?.data?.message });
      alert(error.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    log.action('Delete user confirmed', { id: deleteTarget._id, email: deleteTarget.email });
    try {
      await api.delete(`/admin/users/${deleteTarget._id}`);
      log.action('User deleted', { id: deleteTarget._id });
      setDeleteTarget(null);
      fetchUsers(page);
    } catch (error) {
      log.error('User delete failed', { id: deleteTarget._id, error: error?.response?.data?.message });
      alert(error.response?.data?.message || 'Failed to delete user.');
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <UsersIcon size={48} />
          <h3>No Users</h3>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || '—'}</td>
                  <td>
                    <Dropdown
                      value={user.role}
                      options={roleOptions.map((r) => ({ value: r, label: r.replace('_', ' ') }))}
                      onChange={(next) => handleRoleChange(user._id, next)}
                      ariaLabel="User role"
                      className="role-select"
                    />
                  </td>
                  <td>
                    <span className={`badge ${user.isActive ? 'badge-active' : 'badge-inactive'}`}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-group">
                      <button
                        className={`btn-sm ${user.isActive ? 'btn-danger' : 'btn-outline'}`}
                        onClick={() => handleStatusToggle(user._id, user.isActive)}
                        title={user.isActive ? 'Deactivate user' : 'Activate user'}
                      >
                        {user.isActive ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </button>
                      <button
                        className="btn-sm btn-delete"
                        onClick={() => setDeleteTarget(user)}
                        title="Delete user permanently"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} unit="users" />

      {deleteTarget && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to permanently delete "${deleteTarget.name}" (${deleteTarget.email})? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Users;
