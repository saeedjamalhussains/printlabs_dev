import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const isProd = env.NODE_ENV === 'production';

// In development we bypass rate limiting entirely — it's noisy when you
// reload pages, retry logins, or run integration tests against the live
// server. Production keeps the protection intact.
const skipInDev = () => !isProd;

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // bumped from 100 — dashboards fan out a lot of GETs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});

// Only failed auth attempts count toward the limit so the user can log
// in repeatedly during dev without getting locked out by good logins.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInDev,
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many payment requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});

// Coupon validation answers "is this a real code, and what is it worth",
// which is precisely the oracle a script needs to enumerate codes. It
// gets its own tight bucket, separate from the general API limit.
export const couponLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many coupon attempts. Please try again in a few minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});

// Every chat message reaches a paid LLM, so this is a spend limit as much
// as an abuse limit. Sized for a real conversation — a customer asking
// about posters sends a handful of messages, not thirty.
export const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'You are sending messages too quickly. Please wait a moment before asking again.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
});
