import crypto from 'crypto';
import User from './User.js';

/**
 * Perform a secure soft-delete of a user.
 * Frees their registered email address, hashes personal identifier data,
 * and invalidates outstanding session JWT tokens by version-incrementing.
 *
 * @param {string} userId
 * @returns {Promise<object|null>} The deleted user document or null
 */
export const softDeleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  // Set soft delete flags
  user.status = 'deleted';
  user.deletedAt = new Date();
  user.isActive = false;

  // Secure hash copy of original email for fraud/abuse check pools
  const originalEmail = user.email.toLowerCase().trim();
  user.originalEmailHash = crypto.createHash('sha256').update(originalEmail).digest('hex');

  // Rewrite active email property to free up the unique constraint key
  user.email = `deleted_${user._id}@deleted.local`;

  // Anonymize personal info fields
  user.name = 'Deleted User';
  user.phone = '';
  user.address = {
    street: '',
    city: '',
    state: '',
    pincode: ''
  };

  // Invalidate any active session JWTs immediately
  user.tokenVersion = (user.tokenVersion || 0) + 1;

  // Scramble and hash password placeholder.
  // When saved, Mongoose's pre-save middleware will automatically hash this.
  const secureRandomString = crypto.randomBytes(32).toString('hex');
  user.password = `DELETED_${secureRandomString}`;

  await user.save();
  return user;
};
