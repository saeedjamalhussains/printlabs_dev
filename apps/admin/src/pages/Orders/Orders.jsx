import { useCallback, useState, useEffect, Fragment } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import api from '../../services/adminApi';
import Dropdown from '../../components/Dropdown/Dropdown';
import Pagination from '../../components/Pagination/Pagination';
import log from '../../utils/logger';
import {
  Button, ConfirmDialog, EmptyState, PageHeader, TableSkeleton, toast,
} from '@printlabs/ui';
import './Orders.css';

// Which moves the server will actually accept, mirroring
// ALLOWED_TRANSITIONS in orderController. Offering every status meant the
// dropdown listed changes that could only ever return a 400 — such as
// reviving a cancelled order, or shipping a delivered one.
const ALLOWED_TRANSITIONS = {
  placed: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// The current status stays in the list so the dropdown can display it.
const statusOptionsFor = (current) => [current, ...(ALLOWED_TRANSITIONS[current] || [])];

// Map verbose Razorpay error sentences to short admin-facing messages.
// Keeps the operator informed without dumping a wall of API copy on screen.
const friendlyRefundError = (raw = '') => {
  const s = String(raw).toLowerCase();
  if (s.includes('not have enough balance')) {
    return 'Insufficient merchant balance. Wait for settlement or top up funds in Razorpay.';
  }
  if (s.includes('already') && s.includes('refund')) {
    return 'This payment has already been refunded.';
  }
  if (s.includes('payment captured but already refunded')) {
    return 'This payment has already been refunded.';
  }
  if (s.includes('does not exist')) {
    return 'Payment record not found on Razorpay (key mismatch?).';
  }
  if (s.includes('failed payment')) {
    return 'Payment never succeeded — nothing to refund.';
  }
  if (s.includes('captured')) {
    return 'Payment is not yet captured by Razorpay.';
  }
  // Fallback — strip overly long sentences down to the first clause.
  return raw.length > 110 ? raw.slice(0, 107).replace(/[\s.,;:]+$/, '') + '…' : raw;
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [refundingId, setRefundingId] = useState(null);
  // Which order the refund confirmation is open for. This replaces an
  // "armed" flag plus a 4-second timer: refunding used to mean clicking
  // the same button twice inside that window, which is undiscoverable,
  // puts a clock on an irreversible movement of money, and never showed
  // the amount about to leave the account.
  const [refundTarget, setRefundTarget] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback(async (targetPage) => {
    try {
      const { data } = await api.get('/orders', { params: { page: targetPage } });
      setOrders(data.data.orders);
      setPagination(data.data.pagination);
    } catch (error) {
      console.debug('Failed to fetch orders', error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { fetchOrders(page); }, [fetchOrders, page]);

  const handleStatusChange = async (orderId, newStatus) => {
    const prev = orders.find((o) => o._id === orderId)?.orderStatus;
    log.action('Order status change requested', { orderId, from: prev, to: newStatus });
    setUpdatingId(orderId);
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      log.action('Order status updated', { orderId, status: newStatus });
      fetchOrders(page);
    } catch (error) {
      log.error('Status update failed', { orderId, error: error.response?.data?.message });
      toast.error('Could not update this order', {
        description: error.response?.data?.message || 'The status was left unchanged.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const triggerRefund = async () => {
    const order = refundTarget;
    if (!order) return;

    log.action('Refund confirmed — calling Razorpay', { orderId: order._id });
    setRefundingId(order._id);
    try {
      const { data } = await api.post(`/admin/orders/${order._id}/refund`);
      log.action('Refund initiated', {
        orderId: order._id,
        refundId: data?.data?.order?.payment?.refundId,
      });
      // Only dismiss once it actually worked — a failure keeps the dialog
      // open so the reason is read next to the thing it refers to.
      setRefundTarget(null);
      toast.success('Refund initiated', {
        description: data?.message || `₹${order.totalAmount.toLocaleString()} is on its way back to the customer.`,
      });
      fetchOrders(page);
    } catch (error) {
      const raw = error.response?.data?.message || error.message || 'Refund failed';
      log.error('Refund failed', { orderId: order._id, raw });
      toast.error('Refund failed', { description: friendlyRefundError(raw) });
    } finally {
      setRefundingId(null);
    }
  };

  return (
    <div className="orders-page">
      {/* The count belongs beside the title: it says how much work is in
          the queue before a single row is read. */}
      <PageHeader
        title="Orders"
        count={pagination?.total != null ? pagination.total.toLocaleString() : undefined}
        description="Fulfilment queue. Expand an order for its items, address and payment."
        className="mb-6"
      />

      {loading ? (
        /* The table structure is already known, so it stays on screen and
           fills in. Replacing the whole page with the word "Loading" threw
           away the header and column layout and made every navigation feel
           like a reload. */
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th>
                <th>Status</th><th>Date</th><th>Details</th>
              </tr>
            </thead>
            <TableSkeleton rows={8} cols={7} />
          </table>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="When a customer completes checkout, their order appears here ready to be confirmed and packed."
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="cell-numeric">Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const paid = order.payment?.status === 'paid';
                const refunded = order.payment?.status === 'refunded';
                const isRefunding = refundingId === order._id;

                return (
                  <Fragment key={order._id}>
                    <tr>
                      <td className="cell-id">{order._id.slice(-8).toUpperCase()}</td>
                      <td>
                        <div>{order.user?.name || 'Unknown'}</div>
                        <div className="cell-sub">{order.user?.email}</div>
                      </td>
                      <td className="cell-numeric">{order.items.length}</td>
                      {/* Right-aligned tabular figures: money is compared
                          down a column, which only works on a shared
                          decimal edge. */}
                      <td className="cell-numeric">₹{order.totalAmount.toLocaleString()}</td>
                      <td>
                        <Dropdown
                          value={order.orderStatus}
                          options={statusOptionsFor(order.orderStatus)}
                          onChange={(next) => handleStatusChange(order._id, next)}
                          disabled={updatingId === order._id}
                          ariaLabel="Order status"
                          className="status-select"
                        />
                      </td>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td>
                        {/* Was an unlabelled chevron: a screen reader
                            announced only "button", and nothing conveyed
                            whether the row was already open. */}
                        <button
                          type="button"
                          className="btn-outline btn-sm btn-icon"
                          onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                          aria-expanded={expandedOrder === order._id}
                          aria-controls={`order-detail-${order._id}`}
                          aria-label={
                            expandedOrder === order._id
                              ? `Hide details for order ${order._id.slice(-8).toUpperCase()}`
                              : `Show details for order ${order._id.slice(-8).toUpperCase()}`
                          }
                        >
                          {expandedOrder === order._id
                            ? <ChevronUp size={14} aria-hidden="true" />
                            : <ChevronDown size={14} aria-hidden="true" />}
                        </button>
                      </td>
                    </tr>

                    {expandedOrder === order._id && (
                      <tr key={`${order._id}-detail`} className="order-detail-row">
                        <td colSpan="7" id={`order-detail-${order._id}`}>
                          <div className="order-detail-content">
                            <div className="detail-section">
                              <h4>Items</h4>
                              {order.items.map((item, idx) => (
                                <div key={idx} className="detail-item">
                                  <span>{item.title} {item.isDiscontinued && <em>(Discontinued)</em>}</span>
                                  <span>x{item.quantity} — ₹{item.price * item.quantity}</span>
                                </div>
                              ))}
                            </div>

                            <div className="detail-section">
                              <h4>Shipping</h4>
                              <p>
                                {order.shippingAddress?.name}, {order.shippingAddress?.street},
                                {order.shippingAddress?.city} - {order.shippingAddress?.pincode}
                              </p>
                            </div>

                            <div className="detail-section">
                              <h4>Payment</h4>
                              <p>
                                <span className={`badge badge-${
                                  paid ? 'delivered' : refunded ? 'shipped' : 'cancelled'
                                }`}>
                                  {order.payment?.status}
                                </span>
                                &nbsp;&nbsp;ID: <code>{order.payment?.razorpayPaymentId || '—'}</code>
                              </p>

                              {refunded && (
                                <p className="detail-refund">
                                  <span className="detail-refund-label">Refund</span>{' '}
                                  <code>{order.payment.refundId}</code>{' '}
                                  <span className="detail-refund-meta">
                                    · ₹{(order.payment.refundAmount / 100).toLocaleString()}
                                    {order.payment.refundedAt &&
                                      ` · ${new Date(order.payment.refundedAt).toLocaleDateString()}`}
                                  </span>
                                </p>
                              )}

                              {paid && (
                                <div className="detail-refund-action">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      log.action('Refund requested', { orderId: order._id });
                                      setRefundTarget(order);
                                    }}
                                    loading={isRefunding}
                                    loadingLabel="Refunding…"
                                  >
                                    <RotateCcw aria-hidden="true" />
                                    <span>Refund payment</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        pagination={pagination}
        onChange={setPage}
        busy={Boolean(updatingId)}
        unit="orders"
      />

      {/* States the amount, the customer and the order before committing,
          and cannot be dismissed by a stray click on the backdrop. */}
      <ConfirmDialog
        open={Boolean(refundTarget)}
        onOpenChange={(next) => { if (!next) setRefundTarget(null); }}
        title={refundTarget ? `Refund ₹${refundTarget.totalAmount.toLocaleString()}?` : ''}
        description={
          refundTarget
            ? `This returns ₹${refundTarget.totalAmount.toLocaleString()} to ${refundTarget.user?.name || 'the customer'} for order ${refundTarget._id.slice(-8).toUpperCase()}. Razorpay refunds cannot be reversed from here.`
            : ''
        }
        confirmLabel="Refund payment"
        cancelLabel="Keep payment"
        onConfirm={triggerRefund}
        loading={Boolean(refundingId)}
      />
    </div>
  );
};

export default Orders;
