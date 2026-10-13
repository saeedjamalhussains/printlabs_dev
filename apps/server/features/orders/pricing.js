/**
 * Order Pricing — the single source of truth for what an order costs.
 * ───────────────────────────────────────────────────────────────────
 * Both the payment-intent endpoint and the payment-verification endpoint
 * call this. That matters: previously the intent was created from a
 * client-supplied amount while verification recomputed its own total, so
 * the two could disagree and nothing ever compared them. Deriving both
 * from one function makes the amount charged and the amount recorded
 * structurally identical.
 *
 * Nothing here trusts the client beyond product ids, sizes and quantities.
 * Prices, size modifiers and discounts are all read from the database.
 */

import crypto from 'crypto';
import Product from '../products/Product.js';
import { evaluateCoupon } from '../coupons/couponService.js';
import { toPaise, toRupees } from '../../utils/money.js';
import AppError from '../../utils/AppError.js';

const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 100;

/**
 * @param {Array}  items       [{ product, quantity, size }]
 * @param {string} [couponCode]
 * @param {object} [opts]
 * @param {boolean} [opts.checkStock=true]
 * @param {boolean} [opts.requireValidCoupon=true] When false, an expired or
 *        exhausted coupon yields a zero discount instead of throwing. Used
 *        after payment has been taken, where rejecting the order would
 *        leave the customer charged with nothing to show for it.
 * @param {object} [opts.user] the customer, needed for per-user coupon limits
 * @returns {Promise<{items: Array, subtotal: number, discount: number, total: number, coupon: object|null}>}
 */
export const priceOrder = async (
  items,
  couponCode,
  { checkStock = true, requireValidCoupon = true, user = null } = {}
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Order must contain at least one item', 400);
  }
  if (items.length > MAX_ITEMS) {
    throw new AppError(`An order cannot contain more than ${MAX_ITEMS} distinct items`, 400);
  }

  // Fetch every product in one round trip rather than one query per line
  // item — this endpoint used to issue N sequential finds.
  const ids = items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids }, isActive: true })
    .select('title price sizes stock images')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  // Accumulated in integer paise. Summing rupees as floats left residue
  // in the recorded discount — see utils/money.js.
  let subtotalPaise = 0;
  const priced = [];

  for (const item of items) {
    const product = byId.get(String(item.product));
    if (!product) {
      throw new AppError(`Product ${item.product} is unavailable`, 404);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      throw new AppError(`Invalid quantity for "${product.title}"`, 400);
    }
    if (checkStock && product.stock < quantity) {
      throw new AppError(`Insufficient stock for "${product.title}"`, 400);
    }

    // A size is only honoured if the product actually offers it. An
    // unrecognised size label is rejected rather than silently ignored,
    // so a client cannot request a cheaper variant that does not exist.
    let unitPrice = product.price;
    if (item.size) {
      const option = product.sizes?.find((s) => s.label === item.size);
      if (!option) {
        throw new AppError(`Size "${item.size}" is not available for "${product.title}"`, 400);
      }
      unitPrice += option.priceModifier || 0;
    }

    // Quantise the unit price before multiplying, so the line total is an
    // exact integer count of paise rather than a float product.
    const unitPricePaise = toPaise(unitPrice);
    subtotalPaise += unitPricePaise * quantity;

    priced.push({
      product: product._id,
      title: product.title,
      imageUrl: product.images?.[0]?.url || '',
      size: item.size,
      price: toRupees(unitPricePaise),
      quantity,
    });
  }

  const subtotal = toRupees(subtotalPaise);

  // Coupon rules live in the coupons feature; pricing just asks.
  const { coupon, discount } = await evaluateCoupon({
    code: couponCode,
    user,
    subtotal,
    strict: requireValidCoupon,
  });

  // Clamp in paise too — a fixed-amount coupon larger than the basket
  // must not drive the total negative.
  const discountPaise = Math.min(Math.max(0, toPaise(discount)), subtotalPaise);

  return {
    items: priced,
    subtotal,
    discount: toRupees(discountPaise),
    total: toRupees(subtotalPaise - discountPaise),
    coupon,
  };
};

export { toPaise } from '../../utils/money.js';

/**
 * A stable hash of exactly what the customer agreed to buy.
 *
 * Recorded in the Razorpay order's notes when the payment intent is
 * created, then re-derived at verification. Because the intent amount was
 * itself computed server-side from the catalogue, matching fingerprints
 * mean the amount Razorpay collected is provably the amount we priced —
 * without re-deriving the discount at verification time, which would
 * otherwise fail (after the customer has already paid) if a coupon
 * expired or hit its usage limit in between.
 */
export const cartFingerprint = (items, couponCode) => {
  const canonical = [...items]
    .map((i) => `${String(i.product)}:${i.size || ''}:${Number(i.quantity)}`)
    .sort()
    .join('|');
  return crypto
    .createHash('sha256')
    .update(`${canonical}#${String(couponCode || '').toUpperCase().trim()}`)
    .digest('hex');
};
