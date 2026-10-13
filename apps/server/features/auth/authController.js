// ─────────────────────────────────────────────────────────────────────
//  authController — slim
// ─────────────────────────────────────────────────────────────────────
// SMTP, 2FA and password-reset flows have been removed. Auth is now
// the minimum needed to identify a customer: register, login, profile,
// password change. Admins are seeded directly.
// ─────────────────────────────────────────────────────────────────────

import User from './User.js';
import generateToken from '../../utils/generateToken.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import AppError from '../../utils/AppError.js';
import { setAuditChanges } from '../../middleware/auditMiddleware.js';
import { softDeleteUser } from '../../utils/userService.js';

export const ERROR_CODES = Object.freeze({
  INVALID_INPUT:       'INVALID_INPUT',
  EMAIL_TAKEN:         'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED:    'ACCOUNT_DISABLED',
});

const codedError = (message, status, code) => {
  const err = new AppError(message, status);
  err.code = code;
  return err;
};

const issueSession = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  token: generateToken(user),
});

// ─── Register ─────────────────────────────────────────────────────────

export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password) {
    return next(codedError('Please provide name, email, and password', 400, ERROR_CODES.INVALID_INPUT));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    return next(codedError('An account with that email already exists.', 400, ERROR_CODES.EMAIL_TAKEN));
  }

  if (String(password).length < 8) {
    return next(codedError('Password must be at least 8 characters', 400, ERROR_CODES.INVALID_INPUT));
  }

  // `role` is deliberately not read from the body — self-registration
  // always produces a customer, and the schema default enforces it.
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    phone,
    address,
  });

  setAuditChanges(res, { userId: String(user._id), email: user.email });

  res.status(201).json({
    success: true,
    data: issueSession(user),
    message: 'Account created.',
  });
});

// ─── Login ────────────────────────────────────────────────────────────

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(codedError('Please provide email and password', 400, ERROR_CODES.INVALID_INPUT));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    // The audit entry for a failed login carries the attempted address and
    // source IP but never distinguishes "no such user" from "wrong
    // password" to the caller.
    setAuditChanges(res, { attemptedEmail: normalizedEmail, reason: 'invalid_credentials' });
    return next(codedError('Invalid email or password', 401, ERROR_CODES.INVALID_CREDENTIALS));
  }

  if (!user.isActive || user.status === 'deleted') {
    setAuditChanges(res, { userId: String(user._id), email: user.email, reason: 'account_disabled' });
    return next(codedError('Your account has been deactivated or deleted', 403, ERROR_CODES.ACCOUNT_DISABLED));
  }

  setAuditChanges(res, { userId: String(user._id), email: user.email, role: user.role });

  res.status(200).json({ success: true, data: issueSession(user) });
});

// ─── Profile ──────────────────────────────────────────────────────────

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ success: true, data: { user } });
});

export const updateProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(codedError('User not found', 404, ERROR_CODES.INVALID_INPUT));

  if (req.body.name) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.address) user.address = { ...user.address, ...req.body.address };

  if (req.body.email && req.body.email.toLowerCase().trim() !== user.email) {
    const newEmail = req.body.email.toLowerCase().trim();
    const exists = await User.findOne({ email: newEmail });
    if (exists) return next(codedError('Email already in use', 400, ERROR_CODES.EMAIL_TAKEN));
    user.email = newEmail;
  }

  const updated = await user.save();
  res.status(200).json({ success: true, data: issueSession(updated) });
});

export const changePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return next(codedError('Please provide current and new password', 400, ERROR_CODES.INVALID_INPUT));
  }
  if (String(newPassword).length < 8) {
    return next(codedError('New password must be at least 8 characters', 400, ERROR_CODES.INVALID_INPUT));
  }
  if (!(await user.comparePassword(currentPassword))) {
    setAuditChanges(res, { userId: String(user._id), reason: 'wrong_current_password' });
    return next(codedError('Current password is incorrect', 401, ERROR_CODES.INVALID_CREDENTIALS));
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  setAuditChanges(res, { userId: String(user._id), email: user.email, sessionsInvalidated: true });

  res.status(200).json({
    success: true,
    data: issueSession(user),
    message: 'Password updated. Other sessions have been signed out.',
  });
});

export const deleteMe = asyncHandler(async (req, res, next) => {
  const result = await softDeleteUser(req.user._id);
  if (!result) {
    return next(new AppError('User not found', 404));
  }
  res.status(200).json({ success: true, message: 'Account successfully deleted.' });
});
