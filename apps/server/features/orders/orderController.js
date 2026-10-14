import Order from './Order.js';
import Product from '../products/Product.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import AppError from '../../utils/AppError.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { setAuditChanges } from '../../middleware/auditMiddleware.js';
import { parsePaging, buildPagination } from '../../utils/pagination.js';
import { priceOrder, cartFingerprint } from './pricing.js';
import { toPaise, toRupees } from '../../utils/money.js';
import Coupon from '../coupons/Coupon.js';
import { redeemCoupon, releaseRedemption } from '../coupons/couponService.js';
import env from '../../config/env.js';

/**
 * Razorpay client, constructed on first use.
 *
 * Building it at module load meant an unset RAZORPAY_KEY_ID threw while
 * the import graph was still resolving, taking down the entire API —
 * including routes that have nothing to do with payments. Deferring it
 * confines a missing key to the endpoints that actually need it.
 */
let razorpayClient = null;
const getRazorpay = () => {
  if (razorpayClient) return razorpayClient;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new AppError('Payments are not configured on this server', 503);
  }
  razorpayClient = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return razorpayClient;
};

export const ORDER_STATUSES = Object.freeze([
  'placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled',
]);

// Which transitions an admin may make. Prevents nonsense moves such as
// reviving a cancelled order or un-delivering a delivered one.
const ALLOWED_TRANSITIONS = Object.freeze({
  placed: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
});

// Field sets for list vs detail reads. Selecting explicitly keeps large
// documents (item snapshots, full status history) out of list responses.
const LIST_FIELDS =
  'orderStatus totalAmount discountApplied couponCode createdAt buyer payment.status payment.paidAt items.title items.quantity items.price items.imageUrl items.product user';

// ─── Payment intent ───────────────────────────────────────────────────

// @desc    Create a Razorpay order for the customer's current cart
// @route   POST /api/orders/create-razorpay-order
export const createRazorpayOrder = asyncHandler(async (req, res, next) => {
  const { items, couponCode } = req.body;

  // The amount is derived from the catalogue, never accepted from the
  // client. This is what makes the verification comparison meaningful.
  const quote = await priceOrder(items, couponCode, { user: req.user });
  const amountPaise = toPaise(quote.total);

  if (amountPaise < 100) {
    return next(new AppError('Order amount must be at least ₹1', 400));
  }

  try {
    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${String(req.user._id).slice(-6)}`,
      notes: {
        userId: String(req.user._id),
        // Binds this payment to this exact basket. Verification checks it
        // rather than re-pricing, so the amount is fixed at intent time.
        cart: cartFingerprint(items, couponCode),
      },
    });

    setAuditChanges(res, {
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      itemCount: quote.items.length,
      razorpayOrderId: order.id,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...order,
        // Echo the authoritative breakdown so the UI can display exactly
        // what is about to be charged.
        quote: { subtotal: quote.subtotal, discount: quote.discount, total: quote.total },
      },
    });
  } catch (err) {
    const status = err?.statusCode === 401 ? 401 : 500;
    const msg = err?.error?.description || err?.message || 'Failed to create payment order';
    return next(new AppError(msg, status));
  }
});

// ─── Payment verification ─────────────────────────────────────────────

/**
 * Constant-time signature comparison that tolerates malformed input.
 * `crypto.timingSafeEqual` throws on a length mismatch, which previously
 * surfaced as a 500 instead of a clean rejection.
 */
const signatureMatches = (expectedHex, providedHex) => {
  if (typeof providedHex !== 'string' || !/^[0-9a-f]{64}$/i.test(providedHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const provided = Buffer.from(providedHex, 'hex');
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
};

// @desc    Verify a Razorpay payment and persist the order
// @route   POST /api/orders/verify-payment
export const verifyPayment = asyncHandler(async (req, res, next) => {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    items,
    shippingAddress,
    couponCode,
  } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return next(new AppError('Missing payment verification data', 400));
  }

  // 1. Signature — proves the callback genuinely came from Razorpay.
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (!signatureMatches(expected, razorpaySignature)) {
    return next(new AppError('Invalid payment signature', 400));
  }

  // 2. Replay guard — the unique sparse index on razorpayOrderId also
  //    enforces this at the database level, but failing early is cheaper
  //    and produces a clearer message.
  const existing = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId })
    .select('_id')
    .lean();
  if (existing) {
    return res.status(200).json({ success: true, data: { orderId: existing._id }, message: 'Order already recorded.' });
  }

  // 3. Fetch the authoritative order record from Razorpay. Its amount was
  //    set by us at intent time from the catalogue, so it — not anything
  //    in this request — is the reference for what should have been paid.
  let rzpOrder;
  try {
    rzpOrder = await getRazorpay().orders.fetch(razorpayOrderId);
  } catch {
    return next(new AppError('Could not verify the payment with Razorpay', 502));
  }

  if (rzpOrder.status !== 'paid') {
    return next(new AppError(`Payment is not complete (status: ${rzpOrder.status})`, 400));
  }
  if (String(rzpOrder.notes?.userId || '') !== String(req.user._id)) {
    return next(new AppError('This payment does not belong to your account', 403));
  }

  // 4. The basket presented here must be the basket that was priced. This
  //    is what stops a client from paying for a cheap cart and then
  //    submitting an expensive one.
  if (String(rzpOrder.notes?.cart || '') !== cartFingerprint(items, couponCode)) {
    res.locals.auditError = 'cart fingerprint mismatch between payment intent and verification';
    return next(new AppError('The order details do not match the payment. Please contact support.', 400));
  }

  // 5. And the money actually collected must equal the amount we asked for.
  if (Number(rzpOrder.amount_paid) !== Number(rzpOrder.amount)) {
    res.locals.auditError = `partial payment: paid ${rzpOrder.amount_paid} of ${rzpOrder.amount}`;
    return next(new AppError('Payment amount does not match the order total', 400));
  }

  // Re-read the catalogue for item snapshots and the stock check. Coupon
  // validity is deliberately not re-asserted: the price is already fixed
  // by the fingerprint check above, and failing here would mean taking a
  // customer's money and then refusing to record their order.
  const quote = await priceOrder(items, couponCode, { requireValidCoupon: false, user: req.user });

  // Razorpay reports amounts in paise, which is the exact unit. Keep the
  // arithmetic there and convert once, rather than dividing first and
  // subtracting floats.
  const paidPaise = Number(rzpOrder.amount);
  const paidTotal = toRupees(paidPaise);

  // 6. Claim stock, rolling back anything already taken if a line fails.
  const taken = [];
  for (const item of quote.items) {
    const ok = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true, projection: { _id: 1 } }
    );
    if (!ok) {
      await Promise.all(
        taken.map((t) => Product.updateOne({ _id: t.product }, { $inc: { stock: t.quantity } }))
      );
      return next(new AppError(`Insufficient stock for "${item.title}"`, 400));
    }
    taken.push(item);
  }

  // The discount is derived from the gap between catalogue subtotal and
  // what was actually collected, so the recorded figures always reconcile
  // against the payment. Done in paise: subtracting rupee floats stored
  // values like 385.00000000000045 against the order.
  const discountAppliedPaise = Math.max(0, toPaise(quote.subtotal) - paidPaise);
  const discountApplied = toRupees(discountAppliedPaise);
  const appliedCode = String(couponCode || '').toUpperCase().trim() || undefined;

  const order = await Order.create({
    user: req.user._id,
    buyer: { name: req.user.name, email: req.user.email },
    items: quote.items,
    totalAmount: paidTotal,
    couponCode: discountApplied > 0 ? appliedCode : undefined,
    discountApplied,
    payment: {
      razorpayOrderId,
      razorpayPaymentId,
      // The signature is a bearer proof of this callback; it is verified
      // above and has no further use, so it is not persisted.
      status: 'paid',
      paidAt: new Date(),
      amountPaid: rzpOrder.amount_paid,
    },
    shippingAddress,
    orderStatus: 'placed',
    statusHistory: [{ status: 'placed', changedBy: req.user._id }],
  });

  // 7. Record the redemption. Keyed on the order, so a retried
  //    verification cannot double-count, and releasable if the order is
  //    later cancelled or refunded.
  if (discountApplied > 0) {
    // `quote.coupon` is null whenever the coupon stopped being valid
    // between the payment intent and this call — it is priced
    // non-strictly here so the customer still gets their order. But the
    // discount was granted, and the code is written onto the order, so
    // skipping the redemption left an order claiming a coupon with
    // nothing in the ledger: per-user limits under-counted and
    // reconcileUsage could never recover it. Load the coupon directly in
    // that case so the ledger always matches what was charged.
    const coupon = quote.coupon || (appliedCode ? await Coupon.findOne({ code: appliedCode }) : null);

    if (coupon) {
      await redeemCoupon({
        coupon,
        user: req.user,
        order,
        amount: discountApplied,
      });
    }
  }

  setAuditChanges(res, {
    orderId: String(order._id),
    razorpayOrderId,
    razorpayPaymentId,
    total: order.totalAmount,
    discount: discountApplied,
    items: quote.items.map((i) => ({ product: String(i.product), qty: i.quantity, price: i.price })),
  });

  res.status(201).json({ success: true, data: { orderId: order._id } });
});

// ─── Reads ────────────────────────────────────────────────────────────

/** Flag items whose product has been removed or deactivated. */
const markDiscontinued = (orders) => {
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!item.product || item.product.isActive === false) {
        item.isDiscontinued = true;
        item.imageUrl = '';
      }
      if (item.product?._id) item.product = item.product._id;
    }
  }
  return orders;
};

// @desc    Get the signed-in customer's orders
// @route   GET /api/orders/my-orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req, { defaultLimit: 20 });

  const [orders, total] = await Promise.all([
    Order.find({ user: req.user._id })
      .select(LIST_FIELDS)
      .populate('items.product', 'isActive')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments({ user: req.user._id }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders: markDiscontinued(orders),
      pagination: buildPagination(total, { page, limit }),
    },
  });
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
export const getAllOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req, { defaultLimit: 25 });

  // Optional server-side filters so the dashboard stops pulling the whole
  // collection and filtering in the browser.
  const query = {};
  if (req.query.status && ORDER_STATUSES.includes(req.query.status)) {
    query.orderStatus = req.query.status;
  }
  if (req.query.paymentStatus) query['payment.status'] = req.query.paymentStatus;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .select(LIST_FIELDS)
      .populate('user', 'name email')
      .populate('items.product', 'isActive')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders: markDiscontinued(orders),
      pagination: buildPagination(total, { page, limit }),
    },
  });
});

// @desc    Get a single order
// @route   GET /api/orders/:id
export const getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product', 'isActive')
    .lean();

  if (!order) return next(new AppError('Order not found', 404));

  // Ownership check. This route is reachable by any authenticated user,
  // so the check is the only thing standing between a customer and every
  // other customer's name, phone number and delivery address.
  const ownerId = String(order.user?._id ?? order.user ?? '');
  if (ownerId !== String(req.user._id) && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to view this order', 403));
  }

  markDiscontinued([order]);
  res.status(200).json({ success: true, data: { order } });
});

// ─── Mutations ────────────────────────────────────────────────────────

// @desc    Customer cancels their own order
// @route   PUT /api/orders/:id/cancel
export const cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  if (String(order.user) !== String(req.user._id)) {
    return next(new AppError('Not authorized to cancel this order', 403));
  }
  if (order.orderStatus === 'cancelled') {
    return next(new AppError('Order is already cancelled', 400));
  }
  if (!['placed', 'confirmed'].includes(order.orderStatus)) {
    return next(new AppError(`Order can no longer be cancelled — it is ${order.orderStatus}.`, 400));
  }

  const previousStatus = order.orderStatus;
  order.orderStatus = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', changedAt: new Date(), changedBy: req.user._id });

  // Restore stock in one round trip rather than one update per item.
  const restock = order.items
    .filter((i) => i.product)
    .map((i) => ({
      updateOne: { filter: { _id: i.product }, update: { $inc: { stock: i.quantity } } },
    }));
  if (restock.length) await Product.bulkWrite(restock, { ordered: false });

  await order.save();

  // Hand the coupon use back. Without this a customer who cancelled
  // immediately had still spent their one allowed use, and a limited
  // campaign leaked capacity on every cancellation.
  const released = await releaseRedemption(order._id, 'order_cancelled');

  setAuditChanges(res, {
    orderId: String(order._id),
    status: { from: previousStatus, to: 'cancelled' },
    restocked: restock.length,
    couponReleased: released ? released.code : undefined,
  });

  res.status(200).json({
    success: true,
    data: { order },
    message:
      order.payment?.status === 'paid'
        ? 'Order cancelled. Refunds are processed manually within 5-7 business days.'
        : 'Order cancelled.',
  });
});

// @desc    Update order status (admin)
// @route   PUT /api/orders/:id/status  |  PUT /api/admin/orders/:id/status
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
  // Accept either key — the storefront-side route and the admin route
  // historically used different names for the same field.
  const status = req.body.status ?? req.body.orderStatus;

  if (!ORDER_STATUSES.includes(status)) {
    return next(new AppError(`Invalid order status. Expected one of: ${ORDER_STATUSES.join(', ')}`, 400));
  }

  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const from = order.orderStatus;
  if (from === status) {
    return res.status(200).json({ success: true, data: { order } });
  }
  if (!ALLOWED_TRANSITIONS[from]?.includes(status)) {
    return next(new AppError(`Cannot move an order from "${from}" to "${status}".`, 400));
  }

  order.orderStatus = status;
  order.statusHistory.push({ status, changedAt: new Date(), changedBy: req.user._id });
  await order.save();

  setAuditChanges(res, { orderId: String(order._id), status: { from, to: status } });

  res.status(200).json({ success: true, data: { order } });
});

// @desc    Admin refunds a paid order via Razorpay
// @route   POST /api/admin/orders/:id/refund
export const refundOrder = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  if (order.payment?.status !== 'paid') {
    return next(new AppError(
      `Only paid orders can be refunded — current payment status is "${order.payment?.status || 'unknown'}".`,
      400
    ));
  }
  if (!order.payment.razorpayPaymentId) {
    return next(new AppError('Order has no Razorpay payment to refund', 400));
  }
  if (order.payment.refundId) {
    return res.status(200).json({
      success: true,
      data: { order },
      message: `Already refunded (${order.payment.refundId}).`,
    });
  }

  let refund;
  try {
    refund = await getRazorpay().payments.refund(order.payment.razorpayPaymentId, {
      speed: 'normal',
      notes: {
        orderId: String(order._id),
        refundedBy: String(req.user._id),
        reason: reason || 'No reason provided',
      },
    });
  } catch (err) {
    const msg = err?.error?.description || err?.message || 'Razorpay refund failed';
    return next(new AppError(msg, err?.statusCode || 500));
  }

  Object.assign(order.payment, {
    status: 'refunded',
    refundId: refund.id,
    refundedAt: refund.created_at ? new Date(refund.created_at * 1000) : new Date(),
    refundAmount: refund.amount,
    refundedBy: req.user._id,
    refundReason: reason || 'No reason provided',
  });
  order.statusHistory.push({
    status: `refunded:${refund.id}`,
    changedAt: new Date(),
    changedBy: req.user._id,
  });
  await order.save();

  const releasedCoupon = await releaseRedemption(order._id, 'order_refunded');

  setAuditChanges(res, {
    orderId: String(order._id),
    refundId: refund.id,
    amountPaise: refund.amount,
    reason: reason || 'No reason provided',
    couponReleased: releasedCoupon ? releasedCoupon.code : undefined,
  });

  res.status(200).json({
    success: true,
    data: { order, refund },
    message: `Refund initiated (${refund.id}). Funds typically return in 5-7 business days.`,
  });
});
