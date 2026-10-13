import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import app from './app.js';
import { record, close as closeAudit, flushSync } from './utils/auditLog.js';

// 5001, not 5000: on macOS the AirPlay Receiver in Control Center holds
// port 5000, so a default of 5000 fails on a fresh Mac for a reason that
// looks nothing like a port conflict. Hosts that set PORT override this.
const PORT = process.env.PORT || 5001;

// Fail fast on missing configuration rather than surfacing it later as a
// confusing runtime error (an unset JWT_SECRET makes every token forgeable).
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  // `apps/server/.env` is gitignored, so a fresh clone always lands here. Say
  // what to do, not just what is wrong — and say it for this machine:
  // `cp` and `openssl` are not commands a default Windows shell has.
  const windows = process.platform === 'win32';
  const copyCmd = windows
    ? 'copy apps\\server\\.env.example apps\\server\\.env'
    : 'cp apps/server/.env.example apps/server/.env';

  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}\n\n` +
    'apps/server/.env is not in git, so a fresh clone has to create it:\n\n' +
    `  1. ${copyCmd}\n` +
    '  2. Open apps/server/.env and set MONGO_URI to your MongoDB connection string.\n' +
    '  3. Set JWT_SECRET to a fresh 32+ character secret. Generate one with:\n' +
    '     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n\n' +
    'See "Run locally" in README.md.'
  );
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error(
    'JWT_SECRET must be at least 32 characters (it is currently ' +
    `${process.env.JWT_SECRET.length}). Generate one with:\n` +
    '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
  process.exit(1);
}

await connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  record({ act: 'system.start', chg: { port: Number(PORT), node: process.version } });
});

// Keep sockets from being held open indefinitely by idle clients.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// ─── Graceful shutdown ────────────────────────────────────────────────

let shuttingDown = false;

const shutdown = async (signal, error) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received — shutting down.`);
  record({
    act: 'system.stop',
    chg: { signal, uptimeSec: Math.round(process.uptime()) },
    err: error?.message,
  });

  // Stop accepting new work, then drain the audit buffer and the DB pool
  // so nothing recorded in the final moments is lost.
  const forceExit = setTimeout(() => {
    console.error('Shutdown timed out — forcing exit.');
    flushSync();
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await closeAudit();
      await mongoose.connection.close(false);
    } catch (err) {
      console.error('Error during shutdown:', err.message);
    }
    process.exit(error ? 1 : 0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  shutdown('unhandledRejection', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // The process state is no longer trustworthy after this — record it and
  // let the supervisor restart us.
  flushSync();
  shutdown('uncaughtException', err);
});
