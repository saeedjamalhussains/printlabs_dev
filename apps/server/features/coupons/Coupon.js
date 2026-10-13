import mongoose from 'mongoose';
import { roundRupees } from '../../utils/money.js';

/**
 * A discount coupon.
 *
 * The original schema carried only code / type / value / expiry / global
 * usage limit, which left several campaigns impossible to express safely:
 *
 *   - "one per customer" could not be enforced at all, so a single
 *     shopper could drain a whole campaign's usage limit alone;
 *   - a percentage discount had no ceiling, so "50% off" applied to an
 *     arbitrarily large basket;
 *   - there was no minimum spend, no scheduled start, and no way to
 *     restrict an offer to first-time buyers.
 *
 * Redemptions are recorded separately (see CouponRedemption) so that
 * per-user limits, release-on-cancel and reporting all read from real
 * records rather than a single counter.
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      // Codes are typed by hand at checkout; keep them unambiguous.
      match: [/^[A-Z0-9._-]+$/, 'Codes may use letters, numbers, dot, underscore and hyphen only'],
    },

    // Shown in the admin list so an operator can tell campaigns apart.
    description: { type: String, trim: true, maxlength: 140, default: '' },

    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },

    // Ceiling for percentage discounts, in rupees. Ignored for fixed.
    // 0 / null means uncapped.
    maxDiscount: { type: Number, min: 0, default: null },

    // Cart subtotal required before the coupon applies, in rupees.
    minOrderValue: { type: Number, min: 0, default: 0 },

    // Scheduling window. startsAt lets a campaign be staged in advance
    // instead of being switched on by hand at the right moment.
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    // Total redemptions allowed across all customers. 0 = unlimited.
    usageLimit: { type: Number, min: 0, default: 0 },

    // Redemptions allowed per customer. 0 = unlimited.
    perUserLimit: { type: Number, min: 0, default: 1 },

    // Denormalised counter kept in step with the redemption records. It
    // exists so the hot path can reject an exhausted coupon without an
    // aggregate over redemptions.
    usedCount: { type: Number, default: 0, min: 0 },

    // Restrict to customers who have never completed an order.
    firstOrderOnly: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Admin list is newest-first; lookup is always by exact code.
couponSchema.index({ createdAt: -1 });

/**
 * Whether the coupon is currently redeemable, ignoring any particular
 * customer or basket. Returns a machine-readable reason so callers can
 * decide how much to reveal.
 */
couponSchema.methods.availability = function availability(now = new Date()) {
  if (!this.isActive) return { ok: false, reason: 'inactive' };
  if (this.startsAt && this.startsAt > now) return { ok: false, reason: 'not_started' };
  if (this.expiresAt && this.expiresAt < now) return { ok: false, reason: 'expired' };
  if (this.usageLimit && this.usedCount >= this.usageLimit) return { ok: false, reason: 'exhausted' };
  return { ok: true };
};

/**
 * Rupee discount for a given subtotal, with the percentage ceiling and
 * the subtotal itself both applied. A discount can never exceed what is
 * being spent — otherwise a fixed ₹500 coupon on a ₹200 basket would
 * produce a negative total.
 */
couponSchema.methods.discountFor = function discountFor(subtotal) {
  // Percentage discounts land on whole rupees; a fixed amount is taken as
  // configured. Either way the result is quantised to paise before it is
  // returned, so a float subtotal cannot leak residue into the discount
  // that eventually gets stored against the order.
  let discount = this.discountType === 'percent'
    ? Math.round(subtotal * (this.value / 100))
    : this.value;

  if (this.discountType === 'percent' && this.maxDiscount) {
    discount = Math.min(discount, this.maxDiscount);
  }
  return roundRupees(Math.max(0, Math.min(discount, subtotal)));
};

export default mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
