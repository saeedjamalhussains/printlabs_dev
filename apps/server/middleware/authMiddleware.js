import jwt from 'jsonwebtoken';
import User from '../features/auth/User.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from './asyncHandler.js';
import env from '../config/env.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(new AppError('Not authorized, token failed', 401));
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return next(new AppError('User not found', 401));
  }

  // Verify token version. This is bumped on password changes or forced
  // sign-outs, invalidating old sessions immediately without a database lookup.
  if ((decoded.v ?? 0) !== (user.tokenVersion ?? 0)) {
    return next(new AppError('Session expired. Please sign in again.', 401));
  }

  if (!user.isActive || user.status === 'deleted') {
    return next(new AppError('Your account has been deactivated or deleted.', 403));
  }

  req.user = user;
  next();
});

/**
 * Populate req.user when a valid token is present, but never reject.
 *
 * Used on endpoints that serve both anonymous and privileged callers —
 * the product detail route returns an inactive product to an admin (so it
 * can be edited) while still 404-ing for the storefront.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  const token = header.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (
      user &&
      (decoded.v ?? 0) === (user.tokenVersion ?? 0) &&
      user.isActive &&
      user.status !== 'deleted'
    ) {
      req.user = user;
    }
  } catch {
    // An invalid or expired token is simply treated as anonymous here.
  }

  next();
});
