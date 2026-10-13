/**
 * Coupon rules — the single authority on whether a code applies.
 *
 * Validation used to live inline in the order controller, so the
 * "check the coupon" path and the "charge the customer" path each had
 * their own copy of the rules and could disagree. Everything now routes
 * through `evaluateCoupon`.
 *
 * Redemption is deliberately two-phase: `redeemCoupon` when an order is
 * paid, `releaseRedemption` when it is cancelled or refunded. The old
 * single counter could only ever go up, so a cancelled order burned a
 * use forever.
 */

import mongoose from 'mongoose';
import Coupon from './Coupon.js';
import CouponRedemption from './CouponRedemption.js';
import Order from '../orders/Order.js';
import AppError from '../../utils/AppError.js';

export const COUPON_ERRORS = Object.freeze({
  NOT_FOUND: 'COUPON_NOT_FOUND',
  INACTIVE: 'COUPON_INACTIVE',
  NOT_STARTED: 'COUPON_NOT_STARTED',
  EXPIRED: 'COUPON_EXPIRED',
  EXHAUSTED: 'COUPON_EXHAUSTED',
  USER_LIMIT: 'COUPON_USER_LIMIT',
  MIN_ORDER: 'COUPON_MIN_ORDER',
  FIRST_ORDER_ONLY: 'COUPON_FIRST_ORDER_ONLY',
});

const fail = (message, code, status = 400) => {
  const err = new AppError(message, status);
  err.code = code;
  return err;
};

/** Human-facing text for the availability reasons the model reports. */
const AVAILABILITY_MESSAGES = {
  inactive: ['This coupon is no longer active', COUPON_ERRORS.INACTIVE],
  not_started: ['This coupon is not active yet', COUPON_ERRORS.NOT_STARTED],
  expired: ['This coupon has expired', COUPON_ERRORS.EXPIRED],
  exhausted: ['This coupon has reached its usage limit', COUPON_ERRORS.EXHAUSTED],
};

/**
 * Decide whether `code` applies to `subtotal` for `user`, and by how much.
 *
 * @param {object}  args
 * @param {string}  args.code
 * @param {object}  args.user      the authenticated customer
 * @param {number}  args.subtotal  cart subtotal in rupees, pre-discount
 * @param {boolean} [args.strict=true] when false, a coupon that has become
 *        invalid resolves to a zero discount instead of throwing. Used
 *        after payment, where rejecting the order would mean taking the
 *        customer's money and giving them nothing.
 * @returns {Promise<{coupon: object|null, discount: number, reason?: string}>}
 */
export const evaluateCoupon = async ({ code, user, subtotal, strict = true }) => {
  if (!code) return { coupon: null, discount: 0 };

  const normalized = String(code).toUpperCase().trim();

  const settle = (error, reason) => {
    if (strict) throw error;
    return { coupon: null, discount: 0, reason };
  };

  const coupon = await Coupon.findOne({ code: normalized });
  if (!coupon) {
    return settle(
      fail('Invalid coupon code', COUPON_ERRORS.NOT_FOUND, 404),
      'not_found'
    );
  }

  const availability = coupon.availability();
  if (!availability.ok) {
    const [message, errCode] = AVAILABILITY_MESSAGES[availability.reason];
    return settle(fail(message, errCode), availability.reason);
  }

  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return settle(
      fail(
        `Add ₹${coupon.minOrderValue - subtotal} more to use this coupon (minimum order ₹${coupon.minOrderValue})`,
        COUPON_ERRORS.MIN_ORDER
      ),
      'min_order'
    );
  }

  // Per-customer limit, counted from real redemptions rather than a
  // global tally — this is the check that makes "one per customer"
  // actually mean one per customer.
  if (user?._id && coupon.perUserLimit) {
    const used = await CouponRedemption.countDocuments({
      coupon: coupon._id,
      user: user._id,
      status: 'applied',
    });
    if (used >= coupon.perUserLimit) {
      return settle(
        fail('You have already used this coupon', COUPON_ERRORS.USER_LIMIT),
        'user_limit'
      );
    }
  }

  if (coupon.firstOrderOnly && user?._id) {
    const priorOrder = await Order.exists({
      user: user._id,
      'payment.status': { $in: ['paid', 'refunded'] },
    });
    if (priorOrder) {
      return settle(
        fail('This coupon is for first orders only', COUPON_ERRORS.FIRST_ORDER_ONLY),
        'first_order_only'
      );
    }
  }

  return { coupon, discount: coupon.discountFor(subtotal) };
};

/**
 * Record a redemption against a paid order and advance the counter.
 *
 * The unique index on `order` makes this idempotent: a retried payment
 * verification cannot double-count. The counter is only incremented when
 * a genuinely new record is written.
 */
export const redeemCoupon = async ({ coupon, user, order, amount }) => {
  if (!coupon || !amount) return null;

  try {
    const redemption = await CouponRedemption.create({
      coupon: coupon._id,
      code: coupon.code,
      user: user._id,
      order: order._id,
      amount,
    });

    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
    return redemption;
  } catch (err) {
    // Duplicate key = this order was already redeemed. Not an error.
    if (err.code === 11000) return null;
    throw err;
  }
};

/**
 * Give a use back when an order is cancelled or refunded.
 *
 * Without this a customer who cancelled immediately still consumed their
 * one allowed use, and a limited campaign leaked capacity on every
 * cancellation.
 */
export const releaseRedemption = async (orderId, reason = 'order_cancelled') => {
  const redemption = await CouponRedemption.findOneAndUpdate(
    { order: orderId, status: 'applied' },
    { status: 'released', releasedAt: new Date(), releaseReason: reason },
    { new: true }
  );
  if (!redemption) return null;

  // Never let the counter go below zero, whatever the history.
  await Coupon.updateOne(
    { _id: redemption.coupon, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } }
  );
  return redemption;
};

/**
 * Recompute `usedCount` from the redemption records.
 *
 * The counter is a denormalisation; this repairs it if it ever drifts
 * (an interrupted write, or data predating the redemption records).
 */
export const reconcileUsage = async (couponId) => {
  const applied = await CouponRedemption.countDocuments({
    coupon: couponId,
    status: 'applied',
  });
  await Coupon.updateOne({ _id: couponId }, { usedCount: applied });
  return applied;
};

/** Redemption history for one coupon, newest first. */
export const listRedemptions = async (couponId, { limit = 50, skip = 0 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new AppError('Invalid coupon id', 400);
  }
  const [redemptions, total] = await Promise.all([
    CouponRedemption.find({ coupon: couponId })
      .populate('user', 'name email')
      .select('code amount status createdAt releasedAt order user')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    CouponRedemption.countDocuments({ coupon: couponId }),
  ]);
  return { redemptions, total };
};
