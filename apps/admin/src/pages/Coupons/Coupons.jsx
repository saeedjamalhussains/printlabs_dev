import { useCallback, useEffect, useState } from 'react';
import { Trash2, Tag, Power, Pencil } from 'lucide-react';
import api from '../../services/adminApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import Pagination from '../../components/Pagination/Pagination';
import CouponForm from './CouponForm';
import log from '../../utils/logger';
import './Coupons.css';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const notify = (kind, text) => {
    setFeedback({ kind, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchCoupons = useCallback(async (targetPage) => {
    try {
      const { data } = await api.get('/coupons', { params: { page: targetPage } });
      setCoupons(data?.data?.coupons || []);
      setPagination(data?.data?.pagination || null);
    } catch (error) {
      log.error('Coupons list failed', { error: error?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch, not a cascading render
    fetchCoupons(page);
  }, [fetchCoupons, page]);

  const handleSubmit = async (payload) => {
    setPosting(true);
    try {
      if (editing) {
        await api.put(`/coupons/${editing._id}`, payload);
        notify('ok', `Coupon ${payload.code} updated.`);
        setEditing(null);
      } else {
        await api.post('/coupons', payload);
        notify('ok', `Coupon ${payload.code} created.`);
      }
      fetchCoupons(page);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Could not save coupon.';
      log.error('Coupon save failed', { error: msg });
      notify('err', msg);
    } finally {
      setPosting(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      const { data } = await api.put(`/coupons/${coupon._id}`, { isActive: !coupon.isActive });
      setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? data.data.coupon : c)));
    } catch (error) {
      notify('err', error?.response?.data?.message || 'Could not update coupon.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/coupons/${deleteTarget._id}`);
      notify('ok', `Coupon ${deleteTarget.code} deleted.`);
      setDeleteTarget(null);
      fetchCoupons(page);
    } catch (error) {
      // A redeemed coupon is refused unless forced — surface that reason
      // rather than failing silently.
      notify('err', error?.response?.data?.message || 'Could not delete coupon.');
      setDeleteTarget(null);
    }
  };

  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  /**
   * Mirrors the server's availability rules so the table never claims a
   * coupon is usable when checkout would reject it.
   */
  const couponState = (c) => {
    const now = new Date();
    if (!c.isActive) return { label: 'Inactive', tone: 'off' };
    if (c.startsAt && new Date(c.startsAt) > now) return { label: 'Scheduled', tone: 'pending' };
    if (c.expiresAt && new Date(c.expiresAt) < now) return { label: 'Expired', tone: 'dead' };
    if (c.usageLimit && c.usedCount >= c.usageLimit) return { label: 'Used up', tone: 'dead' };
    return { label: 'Active', tone: 'on' };
  };

  const describeDiscount = (c) =>
    c.discountType === 'percent'
      ? `${c.value}%${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ''}`
      : `₹${c.value}`;

  const describeLimits = (c) => {
    const parts = [];
    parts.push(c.usageLimit ? `${c.usedCount}/${c.usageLimit}` : `${c.usedCount}/∞`);
    if (c.perUserLimit) parts.push(`${c.perUserLimit} per customer`);
    else parts.push('unlimited per customer');
    return parts;
  };

  return (
    <div className="coupons-page">
      <div className="page-header">
        <h1>Coupons</h1>
      </div>

      {feedback && (
        <div className={`coupons-feedback coupons-feedback-${feedback.kind}`}>{feedback.text}</div>
      )}

      <div className="coupons-grid-layout">
        <section className="coupon-composer">
          <h2 className="coupon-composer-title">
            {editing ? `Edit ${editing.code}` : 'Create a Coupon'}
          </h2>
          <CouponForm
            key={editing?._id || 'new'}
            editing={editing}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            busy={posting}
          />
        </section>

        <section className="coupons-list-section">
          <h2 className="coupons-list-title">All Coupons</h2>

          {loading ? (
            <div className="coupons-loading">Loading…</div>
          ) : coupons.length === 0 ? (
            <div className="coupons-empty">
              <Tag size={32} />
              <p>No coupons yet</p>
              <span>Create one using the form alongside.</span>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Usage</th>
                    <th>Window</th>
                    <th>Status</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => {
                    const state = couponState(coupon);
                    const [usage, perUser] = describeLimits(coupon);
                    const starts = formatDate(coupon.startsAt);
                    const expires = formatDate(coupon.expiresAt);

                    return (
                      <tr key={coupon._id}>
                        <td className="coupon-code-cell" title={coupon.description || coupon.code}>
                          {coupon.code}
                          {coupon.firstOrderOnly && <span className="coupon-tag">1st</span>}
                        </td>

                        <td className="coupon-discount-cell">
                          {describeDiscount(coupon)}
                          {coupon.minOrderValue > 0 && (
                            <span className="coupon-sub">min ₹{coupon.minOrderValue}</span>
                          )}
                        </td>

                        <td className="coupon-usage-cell">
                          {usage}
                          <span className="coupon-sub">{perUser}</span>
                        </td>

                        <td className="coupon-expiry-cell">
                          {starts && <span className="coupon-sub">from {starts}</span>}
                          {expires ? <span>till {expires}</span> : <span>No expiry</span>}
                        </td>

                        <td>
                          <span className={`coupon-state coupon-state-${state.tone}`}>{state.label}</span>
                        </td>

                        <td className="col-actions">
                          <div className="coupon-actions">
                            <button
                              onClick={() => setEditing(coupon)}
                              className="coupon-icon-btn"
                              title="Edit coupon"
                              aria-label={`Edit ${coupon.code}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(coupon)}
                              className={`coupon-icon-btn ${coupon.isActive ? 'is-on' : ''}`}
                              title={coupon.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                              aria-label={coupon.isActive ? `Deactivate ${coupon.code}` : `Activate ${coupon.code}`}
                            >
                              <Power size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(coupon)}
                              className="coupon-icon-btn is-danger"
                              title="Delete coupon"
                              aria-label={`Delete ${coupon.code}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination pagination={pagination} onChange={setPage} unit="coupons" />
        </section>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Coupon"
          message={
            deleteTarget.usedCount > 0
              ? `"${deleteTarget.code}" has been redeemed ${deleteTarget.usedCount} time(s). Deleting it removes it from the catalogue but keeps the order history. Deactivating is usually safer.`
              : `Permanently delete the coupon "${deleteTarget.code}"?`
          }
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Coupons;
