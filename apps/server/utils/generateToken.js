import jwt from 'jsonwebtoken';

// The JSON Web Token (JWT) embeds the user's `tokenVersion`. The authentication
// middleware compares it against the current database value. Any mismatch (for
// example, after a password change) invalidates the token without requiring a
// server-side token blocklist.
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, v: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export default generateToken;
