import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // ── Memory & Connection Optimization ──
      maxPoolSize: 10,          // Max concurrent connections (default 100 is wasteful)
      minPoolSize: 2,           // Keep 2 connections warm
      serverSelectionTimeoutMS: 5000,  // Fail fast if DB is unreachable
      socketTimeoutMS: 45000,   // Close idle sockets after 45s
      maxIdleTimeMS: 30000,     // Free idle connections after 30s
      // Wire compression, zlib only — and the "only" is the point.
      //
      // This asked for ['zstd', 'snappy', 'zlib']. The driver offers the
      // list to the server, the server picks the first it supports, and
      // both zstd and snappy then need an optional native module
      // (@mongodb-js/zstd, snappy) that is not among this project's
      // dependencies. Against MongoDB Atlas that went unnoticed; against
      // a stock mongo:7 server, which advertises zstd, every query failed
      // with "Optional module `@mongodb-js/zstd` not found".
      //
      // zlib ships inside Node, so it needs nothing installed. Add the
      // native package first if zstd is ever wanted back.
      compressors: ['zlib'],
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // This exits the process, so the API never binds its port and the
    // frontends report a bare "Network Error". Name the usual causes here
    // — this log is the only place the real reason appears.
    console.error(`MongoDB connection failed: ${error.message}\n`);
    console.error(
      'Common causes:\n' +
      '  • Your IP is not in the Atlas allowlist. Atlas → Network Access →\n' +
      '    Add IP Address → "Add Current IP Address". A new machine or a\n' +
      '    changed home IP needs re-adding.\n' +
      '  • MONGO_URI in apps/server/.env still holds the placeholder, or the\n' +
      '    password contains characters that need percent-encoding.\n' +
      '  • You are offline, or a VPN/firewall is blocking outbound 27017.\n\n' +
      'The API has not started. Any frontend will show "Network Error"\n' +
      'until this is fixed.'
    );
    process.exit(1);
  }
};

export default connectDB;
