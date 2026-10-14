import env from './config/env.js';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import app from './app.js';
import { record, close as closeAudit, flushSync } from './utils/auditLog.js';

// 5001, not 5000: on macOS the AirPlay Receiver in Control Center holds
// port 5000, so a default of 5000 fails on a fresh Mac for a reason that
// looks nothing like a port conflict. Hosts that set PORT override this.
const PORT = env.PORT;

await connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${env.NODE_ENV})`);
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
