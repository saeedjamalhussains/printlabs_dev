/**
 * Audit Middleware — the blackbox recorder
 * ─────────────────────────────────────────
 * Tags every request with an id, then records an audit entry for every
 * state-changing request once the response has been sent. Reads (GET/HEAD)
 * are deliberately not recorded: they are the bulk of the traffic and
 * carry no state change, so logging them would dominate disk for little
 * forensic value.
 *
 * Recording happens on the response 'finish' event, so it is entirely off
 * the request's critical path and adds no measurable latency.
 */

import crypto from 'crypto';
import { record, sanitize } from '../utils/auditLog.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Mongo ObjectIds and long opaque ids collapse to ':id' so that paths
// group into a bounded set of semantic action names.
const normalizePath = (urlPath) =>
  urlPath
    .split('?')[0]
    .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');

/**
 * The id of the record being acted on, taken from the URL.
 *
 * This middleware is mounted at '/api', above every router, so `req.params`
 * has not been populated yet and is always empty here — reading it would
 * silently record no target at all. The path is the reliable source.
 */
const targetFromPath = (urlPath) => {
  const ids = urlPath.split('?')[0].match(/[0-9a-fA-F]{24}/g);
  return ids ? ids[ids.length - 1] : undefined;
};

/**
 * Human-readable action names for the paths we care most about. Anything
 * not listed falls back to `METHOD /normalized/path`, so new routes are
 * still captured — just with a less friendly label.
 */
const ACTIONS = {
  'POST /api/auth/register': 'auth.register',
  'POST /api/auth/login': 'auth.login',
  'PUT /api/auth/me': 'account.update',
  'PUT /api/auth/me/password': 'account.password.change',
  'DELETE /api/auth/me': 'account.delete',

  'POST /api/products': 'product.create',
  'PUT /api/products/:id': 'product.update',
  'DELETE /api/products/:id': 'product.delete',
  'POST /api/products/:id/images': 'product.image.upload',
  'DELETE /api/products/:id/images/:id': 'product.image.delete',

  'POST /api/orders/create-razorpay-order': 'payment.intent.create',
  'POST /api/orders/verify-payment': 'payment.verify',
  'PUT /api/orders/:id/cancel': 'order.cancel',
  'PUT /api/orders/:id/status': 'order.status.update',

  'PUT /api/admin/users/:id/role': 'admin.user.role.update',
  'PUT /api/admin/users/:id/status': 'admin.user.status.update',
  'DELETE /api/admin/users/:id': 'admin.user.delete',
  'PUT /api/admin/products/:id/status': 'admin.product.status.update',
  'DELETE /api/admin/products/:id': 'admin.product.delete',
  'PUT /api/admin/orders/:id/status': 'admin.order.status.update',
  'POST /api/admin/orders/:id/refund': 'admin.order.refund',
  'DELETE /api/admin/orders/:id': 'admin.order.delete',
  'DELETE /api/admin/cloudinary/:id': 'admin.cloudinary.delete',
  'POST /api/admin/newsletter': 'admin.newsletter.create',
  'DELETE /api/admin/newsletter/:id': 'admin.newsletter.delete',

  // Coupons moved out of /api/admin into their own feature module. The
  // old keys were left behind, so every coupon mutation fell through to
  // the generic `POST /api/coupons` label and the blackbox lost the
  // semantic action names it exists to record.
  'POST /api/coupons/validate': 'coupon.validate',
  'POST /api/coupons': 'admin.coupon.create',
  'PUT /api/coupons/:id': 'admin.coupon.update',
  'DELETE /api/coupons/:id': 'admin.coupon.delete',
  'POST /api/coupons/:id/reconcile': 'admin.coupon.reconcile',

  'POST /api/chat': 'ai.chat',
};

/** Best-effort client IP, honouring a proxy hop when trust proxy is set. */
export const clientIp = (req) =>
  req.ip ||
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.socket?.remoteAddress ||
  'unknown';

/** Attach a correlation id to the request and echo it back to the caller. */
export const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export const auditMiddleware = (req, res, next) => {
  if (!MUTATING.has(req.method)) return next();

  const startedAt = process.hrtime.bigint();
  const pathKey = normalizePath(req.originalUrl);
  const action = ACTIONS[`${req.method} ${pathKey}`] || `${req.method} ${pathKey}`;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    record({
      rid: req.id,
      act: action,
      // req.user is populated by `protect`; for anonymous calls (register,
      // login, failed auth) the actor fields are simply absent.
      usr: req.user?._id ? String(req.user._id) : undefined,
      eml: req.user?.email,
      rol: req.user?.role,
      ip: clientIp(req),
      mth: req.method,
      pth: pathKey,
      st: res.statusCode,
      ms: Math.round(durationMs),
      ok: res.statusCode < 400,
      tgt: targetFromPath(req.originalUrl),
      // The request body is the record of what was attempted. Secrets are
      // stripped by `sanitize`; controllers may override this with a
      // precise field-level diff via `res.locals.auditChanges`.
      chg: res.locals.auditChanges ?? sanitize(req.body),
      err: res.locals.auditError,
    });
  });

  next();
};

/**
 * Helper for controllers that want to log a precise before/after diff
 * instead of the raw request body.
 */
export const setAuditChanges = (res, changes) => {
  res.locals.auditChanges = changes;
};

export default auditMiddleware;
