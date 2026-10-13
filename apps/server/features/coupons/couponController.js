import Coupon from './Coupon.js';
import CouponRedemption from './CouponRedemption.js';
import { evaluateCoupon, listRedemptions, reconcileUsage } from './couponService.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { setAuditChanges } from '../../middleware/auditMiddleware.js';
import { diff } from '../../utils/auditLog.js';
import { parsePaging, buildPagination } from '../../utils/pagination.js';
import AppError from '../../utils/AppError.js';

// Fields an admin may set. Anything else in the body is ignored so that
// `usedCount`, `createdBy` and timestamps cannot be written from outside.
const WRITABLE = [
  'code', 'description', 'discountType', 'value', 'maxDiscount', 'minOrderValue',
  'startsAt', 'expiresAt', 'usageLimit', 'perUserLimit', 'firstOrderOnly', 'isActive',
];

const pick = (source, fields) =>
  fields.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});

/** Validate and normalise an admin-supplied coupon payload. */
const normalize = (input, { partial = false } = {}) => {
  const out = pick(input, WRITABLE);

  if (out.code !== undefined) {
    out.code = String(out.code).toUpperCase().trim();
    if (!/^[A-Z0-9._-]{3,32}$/.test(out.code)) {
      throw new AppError('Code must be 3-32 characters: letters, numbers, dot, underscore or hyphen', 400);
    }
  } else if (!partial) {
    throw new AppError('Coupon code is required', 400);
  }

  if (out.discountType !== undefined && !['percent', 'fixed'].includes(out.discountType)) {
    throw new AppError('Discount type must be "percent" or "fixed"', 400);
  }

  const numeric = (key, { min = 0, max = Infinity, label } = {}) => {
    if (out[key] === undefined || out[key] === null || out[key] === '') {
      // An explicitly cleared optional field becomes null, not NaN.
      if (['maxDiscount', 'startsAt', 'expiresAt'].includes(key)) out[key] = null;
      return;
    }
    const n = Number(out[key]);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new AppError(`${label || key} must be between ${min} and ${max}`, 400);
    }
    out[key] = n;
  };

  const type = out.discountType;
  numeric('value', { min: 0, max: type === 'percent' ? 100 : 1_000_000, label: 'Value' });
  numeric('maxDiscount', { min: 0, label: 'Maximum discount' });
  numeric('minOrderValue', { min: 0, label: 'Minimum order value' });
  numeric('usageLimit', { min: 0, label: 'Usage limit' });
  numeric('perUserLimit', { min: 0, label: 'Per-user limit' });

  if (!partial && out.value === undefined) {
    throw new AppError('Value is required', 400);
  }

  for (const key of ['startsAt', 'expiresAt']) {
    if (out[key]) {
      const date = new Date(out[key]);
      if (Number.isNaN(date.getTime())) throw new AppError(`Invalid ${key} date`, 400);
      out[key] = date;
    }
  }

  if (out.startsAt && out.expiresAt && out.startsAt >= out.expiresAt) {
    throw new AppError('The start date must fall before the expiry date', 400);
  }

  // A capped percentage is meaningful; a capped fixed amount is not.
  if (out.discountType === 'fixed') out.maxDiscount = null;

  for (const key of ['firstOrderOnly', 'isActive']) {
    if (out[key] !== undefined) out[key] = Boolean(out[key]);
  }

  return out;
};

// ─── Customer ─────────────────────────────────────────────────────────

// @desc    Check a coupon against the caller's cart
// @route   POST /api/coupons/validate
export const validateCoupon = asyncHandler(async (req, res, next) => {
  const { code, subtotal } = req.body;
  if (!code) return next(new AppError('Please provide a coupon code', 400));

  const amount = Number(subtotal);
  if (!Number.isFinite(amount) || amount < 0) {
    return next(new AppError('Please provide a valid cart total', 400));
  }

  const { coupon, discount } = await evaluateCoupon({
    code,
    user: req.user,
    subtotal: amount,
  });

  // Only the outcome crosses the wire. The coupon's type, rate, limits
  // and schedule stay server-side.
  res.status(200).json({
    success: true,
    data: {
      code: coupon.code,
      discount,
      description: coupon.description || undefined,
    },
  });
});

// ─── Admin ────────────────────────────────────────────────────────────

// @desc    List coupons
// @route   GET /api/coupons
export const getCoupons = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req, { defaultLimit: 25 });

  const query = {};
  if (req.query.status === 'active') query.isActive = true;
  if (req.query.status === 'inactive') query.isActive = false;

  const [coupons, total] = await Promise.all([
    Coupon.find(query).sort('-createdAt').skip(skip).limit(limit).lean(),
    Coupon.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: { coupons, pagination: buildPagination(total, { page, limit }) },
  });
});

// @desc    One coupon with its redemption history
// @route   GET /api/coupons/:id
export const getCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) return next(new AppError('Coupon not found', 404));

  const { redemptions, total } = await listRedemptions(req.params.id, { limit: 50 });

  res.status(200).json({
    success: true,
    data: { coupon, redemptions, redemptionCount: total },
  });
});

// @desc    Create a coupon
// @route   POST /api/coupons
export const createCoupon = asyncHandler(async (req, res, next) => {
  const fields = normalize(req.body);

  if (await Coupon.exists({ code: fields.code })) {
    return next(new AppError('That coupon code already exists', 400));
  }

  const coupon = await Coupon.create({ ...fields, createdBy: req.user._id });

  setAuditChanges(res, {
    couponId: String(coupon._id),
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    usageLimit: coupon.usageLimit,
    perUserLimit: coupon.perUserLimit,
  });

  res.status(201).json({ success: true, data: { coupon } });
});

// @desc    Update a coupon
// @route   PUT /api/coupons/:id
export const updateCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return next(new AppError('Coupon not found', 404));

  // Merge the existing discount type so a partial update validates the
  // value against the right bounds.
  const fields = normalize(
    { discountType: coupon.discountType, ...req.body },
    { partial: true }
  );

  if (fields.code && fields.code !== coupon.code) {
    if (await Coupon.exists({ code: fields.code, _id: { $ne: coupon._id } })) {
      return next(new AppError('That coupon code already exists', 400));
    }
  }

  const before = pick(coupon.toObject(), WRITABLE);
  Object.assign(coupon, fields);
  await coupon.save();

  setAuditChanges(res, {
    couponId: String(coupon._id),
    code: coupon.code,
    ...diff(before, pick(coupon.toObject(), WRITABLE)),
  });

  res.status(200).json({ success: true, data: { coupon } });
});

// @desc    Delete a coupon
// @route   DELETE /api/coupons/:id
export const deleteCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) return next(new AppError('Coupon not found', 404));

  // A redeemed coupon is part of the order history. Deleting it would
  // orphan those records, so deactivating is the safe default and the
  // destructive path has to be asked for explicitly.
  const redeemed = await CouponRedemption.countDocuments({ coupon: coupon._id });
  if (redeemed > 0 && req.query.force !== 'true') {
    return next(new AppError(
      `This coupon has been redeemed ${redeemed} time(s) and is part of the order history. ` +
      'Deactivate it instead, or repeat the request with ?force=true.',
      400
    ));
  }

  await Coupon.deleteOne({ _id: coupon._id });

  setAuditChanges(res, {
    couponId: String(coupon._id),
    code: coupon.code,
    redemptions: redeemed,
    forced: req.query.force === 'true',
  });

  res.status(200).json({ success: true, data: { message: 'Coupon deleted' } });
});

// @desc    Recompute usedCount from redemption records
// @route   POST /api/coupons/:id/reconcile
export const reconcileCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id).select('_id code usedCount').lean();
  if (!coupon) return next(new AppError('Coupon not found', 404));

  const applied = await reconcileUsage(coupon._id);

  setAuditChanges(res, {
    couponId: String(coupon._id),
    code: coupon.code,
    usedCount: { from: coupon.usedCount, to: applied },
  });

  res.status(200).json({
    success: true,
    data: { usedCount: applied, previous: coupon.usedCount },
    message: `Usage recalculated: ${applied} active redemption(s).`,
  });
});
