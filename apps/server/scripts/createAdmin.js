/**
 * Bootstrap or promote an administrator.
 *
 * With authentication restored on the admin portal there has to be a way
 * to mint the first admin account, and a safe way to add more without
 * hand-editing the database.
 *
 *   npm run create-admin -- --email you@example.com --password 'secret' --name 'Your Name'
 *
 * If the email already exists the account is promoted to admin (and its
 * password reset, when one is supplied) instead of failing.
 */

import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../features/auth/User.js';
import { record, close as closeAudit } from '../utils/auditLog.js';

const parseArgs = () => {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1]?.startsWith('--') ? 'true' : argv[i + 1];
    args[key] = value;
    if (value !== 'true') i += 1;
  }
  return args;
};

const run = async () => {
  const { email, password, name } = parseArgs();

  if (!email || !password) {
    console.error('Usage: npm run create-admin -- --email <email> --password <password> [--name <name>]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized }).select('+password');

  if (existing) {
    existing.role = 'admin';
    existing.isActive = true;
    existing.status = 'active';
    existing.password = password;
    // Invalidate any tokens issued before the promotion.
    existing.tokenVersion = (existing.tokenVersion || 0) + 1;
    await existing.save();
    console.log(`Promoted ${normalized} to admin and reset their password.`);
    record({ act: 'admin.bootstrap.promote', eml: normalized, usr: String(existing._id), ok: true });
  } else {
    const user = await User.create({
      name: name || 'Administrator',
      email: normalized,
      password,
      role: 'admin',
    });
    console.log(`Created admin ${normalized}.`);
    record({ act: 'admin.bootstrap.create', eml: normalized, usr: String(user._id), ok: true });
  }

  await closeAudit();
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Failed:', err.message);
  await closeAudit().catch(() => {});
  process.exit(1);
});
