import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight, X } from 'lucide-react';
import api from '../../services/api';
import { degrade } from '../../utils/imageQuality';
import './MyOrders.css';
import AccountLayout from '../../components/AccountLayout/AccountLayout';

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }).toUpperCase();

const shortId = (id) => id?.slice(-8).toUpperCase();

// Cancellation is allowed only before fulfilment leaves the warehouse.
const CANCELLABLE_STATUSES = new Set(['placed', 'confirmed']);

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null); // order pending second-click confirmation
  const [cancellingId, setCancellingId] = useState(null); // order whose cancel request is in flight
  const [feedback, setFeedback] = useState(null); // { kind: 'ok'|'err', text }
  const confirmTimeoutRef = useRef(null);
  const [pagination, setPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/orders/my-orders');
        if (alive) {
          setOrders(data.data.orders);
          setPagination(data.data.pagination);
        }
      } catch (error) {
        if (alive) { setLoadError(true); console.debug('Orders unavailable:', error?.message); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [retry]);

  // Orders come back 20 at a time; append the next page rather than
  // replacing, so the list grows as the customer reads down it.
  const loadMore = async () => {
    if (!pagination?.hasNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get('/orders/my-orders', {
        params: { page: pagination.page + 1 },
      });
      setOrders((prev) => [...prev, ...data.data.orders]);
      setPagination(data.data.pagination);
    } catch (error) {
      console.debug('Could not load more orders:', error?.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // First click arms the cancel button for 4 seconds; if not confirmed,
  // it disarms so users don't fire it by reflex.
  const armCancel = (orderId) => {
    setConfirmingId(orderId);
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    confirmTimeoutRef.current = setTimeout(() => setConfirmingId(null), 4000);
  };

  const confirmCancel = async (orderId) => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setCancellingId(orderId);
    setConfirmingId(null);
    try {
      const { data } = await api.put(`/orders/${orderId}/cancel`);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, orderStatus: 'cancelled' } : o))
      );
      setFeedback({ kind: 'ok', text: data?.message || 'Order cancelled.' });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err?.response?.data?.message || 'Could not cancel this order.',
      });
    } finally {
      setCancellingId(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  if (loading || loadError) return <AccountLayout title="My orders" subtitle="Your prints, from checkout to your doorstep.">
    {loading ? <p role="status">Loading your orders…</p> : <div className="account-feedback" role="alert">We couldn’t load your orders.<button className="account-text-button" onClick={() => { setLoading(true); setLoadError(false); setRetry(n => n + 1); }}>Try again</button></div>}
  </AccountLayout>;

  return (
    <AccountLayout title="My orders" subtitle="Your prints, from checkout to your doorstep.">
    <div className="my-orders-page container">


      {feedback && (
        <div className={`orders-feedback orders-feedback-${feedback.kind}`}>
          {feedback.text}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="orders-empty">
          <Package size={48} />
          <p className="orders-empty-title">No orders yet.</p>
          <Link to="/shop" className="orders-empty-link">
            <span>Find your first piece</span> <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <ul className="orders-list">
          {orders.map((order) => {
            const canCancel = CANCELLABLE_STATUSES.has(order.orderStatus);
            const isConfirming = confirmingId === order._id;
            const isCancelling = cancellingId === order._id;

            return (
              <li key={order._id} className="orders-card">
                <div className="orders-card-head">
                  <div className="orders-card-meta">
                    <p className="orders-card-date">{formatDate(order.createdAt)}</p>
                    <p className="orders-card-id">#{shortId(order._id)}</p>
                  </div>
                  <span className="orders-card-status">{order.orderStatus}</span>
                </div>

                <ul className="orders-card-items">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="orders-card-item">
                      <div className="orders-card-thumb">
                        {item.imageUrl ? (
                          <img src={degrade(item.imageUrl, 'thumb')} alt={item.title} />
                        ) : (
                          <span>N/A</span>
                        )}
                      </div>
                      <div className="orders-card-item-meta">
                        <p className="orders-card-item-title">
                          {item.title}
                          {item.isDiscontinued && <em> (discontinued)</em>}
                        </p>
                        <p className="orders-card-item-qty">Qty {item.quantity}</p>
                      </div>
                      <span className="orders-card-item-price">₹{item.price * item.quantity}</span>
                    </li>
                  ))}
                </ul>

                <div className="orders-card-foot">
                  <p className="orders-card-address">
                    <span>Ship to</span>
                    {order.shippingAddress.name}, {order.shippingAddress.street},{' '}
                    {order.shippingAddress.city} — {order.shippingAddress.pincode}
                  </p>
                  <p className="orders-card-total">
                    <span>Total</span>
                    ₹{order.totalAmount}
                  </p>
                </div>

                {canCancel && (
                  <div className="orders-card-actions">
                    {isConfirming ? (
                      <button
                        type="button"
                        className="orders-cancel-btn orders-cancel-btn--confirm"
                        onClick={() => confirmCancel(order._id)}
                        disabled={isCancelling}
                      >
                        <X size={14} />
                        <span>{isCancelling ? 'Cancelling…' : 'Tap again to confirm'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="orders-cancel-btn"
                        onClick={() => armCancel(order._id)}
                        disabled={isCancelling}
                      >
                        <span>Cancel order</span>
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pagination?.hasNext && (
        <button
          type="button"
          className="orders-load-more"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : `Load older orders (${pagination.total - orders.length} more)`}
        </button>
      )}
    </div>
    </AccountLayout>
  );
};

export default MyOrders;
