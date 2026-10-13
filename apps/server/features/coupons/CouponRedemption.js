import mongoose from 'mongoose';

/**
 * One record per time a coupon is actually applied to a paid order.
 *
 * Previously the only trace a redemption left was `coupon.usedCount++`,
 * which meant:
 *   - per-customer limits were unenforceable;
 *   - a cancelled or refunded order permanently consumed a use;
 *   - there was no way to answer "who used this code, and on what order".
 *
 * Records are kept (status flips to `released`) rather than deleted, so
 * the history survives a cancellation.
 */
const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },

    // Snapshot: the coupon may later be renamed or deleted outright, and
    // the order history still needs to show what was applied.
    code: { type: String, required: true, uppercase: true, trim: true },

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },

    // Rupees actually taken off this order.
    amount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['applied', 'released'],
      default: 'applied',
      index: true,
    },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: null },
  },
  { timestamps: true }
);

// Per-user limit check: count applied redemptions for (coupon, user).
couponRedemptionSchema.index({ coupon: 1, user: 1, status: 1 });

// One redemption per order — a retried verification must not double-count.
couponRedemptionSchema.index({ order: 1 }, { unique: true });

export default mongoose.models.CouponRedemption
  || mongoose.model('CouponRedemption', couponRedemptionSchema);
