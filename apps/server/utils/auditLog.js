/**
 * Blackbox Audit Log — append-only JSONL writer
 * ──────────────────────────────────────────────
 * Every state-changing action in the system is recorded here as one
 * newline-delimited JSON object. The design goals, in order:
 *
 *   1. Never block a request.       Writes are buffered and flushed off the
 *                                   hot path; callers get a synchronous
 *                                   no-op that returns immediately.
 *   2. Never grow without bound.    Files rotate at a size ceiling, archives
 *                                   are gzipped, and the oldest are dropped
 *                                   once the archive count is exceeded. Peak
 *                                   disk use is therefore bounded by
 *                                   AUDIT_MAX_FILE_BYTES * (AUDIT_MAX_FILES + 1).
 *   3. Never leak secrets.          Passwords, tokens and payment signatures
 *                                   are redacted before serialization.
 *   4. Stay small on disk.          Field names are two/three-character keys
 *                                   and empty values are omitted entirely.
 *
 * Field key reference (kept short deliberately — see FIELDS below for the
 * human-readable mapping, which `scripts/audit.js` uses when printing):
 *
 *   ts  timestamp (ISO)        rid request id          act action
 *   usr actor id               eml actor email         rol actor role
 *   ip  client ip              mth http method         pth request path
 *   st  http status            ms  duration ms         tgt target id
 *   chg changed fields         err error message       ok  outcome
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';

// ─── Configuration ────────────────────────────────────────────────────

const LOG_DIR = process.env.AUDIT_LOG_DIR || path.join(process.cwd(), 'logs', 'audit');
const MAX_FILE_BYTES = Number(process.env.AUDIT_MAX_FILE_BYTES) || 5 * 1024 * 1024; // 5MB
const MAX_FILES = Number(process.env.AUDIT_MAX_FILES) || 30;                        // ~150MB ceiling
const FLUSH_INTERVAL_MS = Number(process.env.AUDIT_FLUSH_MS) || 500;
const MAX_BUFFER_ENTRIES = 200;   // force a flush before the buffer gets large
const MAX_VALUE_CHARS = 512;      // truncate any single stringified value

export const FIELDS = Object.freeze({
  ts: 'timestamp', rid: 'requestId', act: 'action', usr: 'actorId',
  eml: 'actorEmail', rol: 'actorRole', ip: 'ip', mth: 'method',
  pth: 'path', st: 'status', ms: 'durationMs', tgt: 'targetId',
  chg: 'changes', err: 'error', ok: 'success',
});

// Keys whose values never reach disk, at any nesting depth.
const REDACTED_KEYS = new Set([
  'password', 'currentpassword', 'newpassword', 'confirmpassword',
  'token', 'accesstoken', 'refreshtoken', 'authorization',
  'razorpaysignature', 'razorpay_signature', 'key_secret', 'apikey',
  'api_key', 'secret', 'cardnumber', 'cvv',
]);

// ─── Writer state ─────────────────────────────────────────────────────

let buffer = [];
let stream = null;
let streamBytes = 0;
let flushTimer = null;
let rotating = false;
let ready = false;

const currentPath = () => path.join(LOG_DIR, 'audit.jsonl');

/** Create the log directory and open the append stream. Idempotent. */
const ensureStream = () => {
  if (stream) return stream;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = currentPath();
  streamBytes = fs.existsSync(file) ? fs.statSync(file).size : 0;
  stream = fs.createWriteStream(file, { flags: 'a' });
  stream.on('error', (err) => {
    // A broken audit sink must never take the API down. Surface it once
    // and fall back to dropping entries until the next rotation retries.
    console.error('[audit] write stream error:', err.message);
    stream = null;
  });
  ready = true;
  return stream;
};

/**
 * Rotate the active file: rename it aside, gzip it in the background, then
 * prune the oldest archives so the archive count stays under MAX_FILES.
 */
const rotate = async () => {
  if (rotating) return;
  rotating = true;
  try {
    const active = currentPath();
    if (stream) {
      await new Promise((resolve) => stream.end(resolve));
      stream = null;
    }
    if (!fs.existsSync(active)) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = path.join(LOG_DIR, `audit-${stamp}.jsonl`);
    fs.renameSync(active, rotated);
    streamBytes = 0;

    // Compress out of band — the archive is typically 8-12x smaller.
    await pipeline(
      fs.createReadStream(rotated),
      zlib.createGzip({ level: 9 }),
      fs.createWriteStream(`${rotated}.gz`)
    );
    fs.unlinkSync(rotated);

    // Prune oldest archives beyond the retention count.
    const archives = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.gz'))
      .sort();
    for (const stale of archives.slice(0, Math.max(0, archives.length - MAX_FILES))) {
      fs.unlinkSync(path.join(LOG_DIR, stale));
    }
  } catch (err) {
    console.error('[audit] rotation failed:', err.message);
  } finally {
    rotating = false;
  }
};

/** Write everything buffered so far in a single syscall. */
const flush = () => {
  if (buffer.length === 0) return;
  const payload = buffer.join('');
  buffer = [];

  try {
    const s = ensureStream();
    if (!s) return;
    s.write(payload);
    streamBytes += Buffer.byteLength(payload);
    if (streamBytes >= MAX_FILE_BYTES) void rotate();
  } catch (err) {
    console.error('[audit] flush failed:', err.message);
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
  // Don't hold the event loop open purely for a pending flush.
  flushTimer.unref?.();
};

// ─── Value sanitization ───────────────────────────────────────────────

const clip = (str) =>
  str.length > MAX_VALUE_CHARS ? `${str.slice(0, MAX_VALUE_CHARS)}…[+${str.length - MAX_VALUE_CHARS}]` : str;

/**
 * Deep-copy a value, redacting secrets and truncating anything oversized.
 * Depth is capped so a pathological payload cannot blow the stack.
 */
export const sanitize = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > 6) return '[depth]';

  if (typeof value === 'string') return clip(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    // Long arrays (e.g. a 200-item cart) are summarized rather than stored.
    if (value.length > 25) return [...value.slice(0, 25).map((v) => sanitize(v, depth + 1)), `…+${value.length - 25} more`];
    return value.map((v) => sanitize(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        out[key] = '[redacted]';
        continue;
      }
      const clean = sanitize(val, depth + 1);
      // Omit empty values outright — this is most of the space saving.
      if (clean === undefined || clean === null || clean === '') continue;
      out[key] = clean;
    }
    return out;
  }
  return String(value);
};

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Record one audit entry. Returns immediately; the write happens on the
 * next flush tick. Never throws — a failure to audit must not fail a request.
 *
 * @param {object} entry Fields using the short keys documented above.
 */
export const record = (entry) => {
  try {
    // Redaction happens here, not at the call sites. Every caller —
    // middleware, controllers via setAuditChanges, and one-off system
    // events — passes through this single point, so a secret cannot reach
    // disk just because one caller forgot to sanitize first.
    const line = { ts: new Date().toISOString(), ...sanitize(entry) };
    // Drop empty fields so each line carries only what it actually knows.
    for (const key of Object.keys(line)) {
      const v = line[key];
      if (v === undefined || v === null || v === '' ||
          (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)) {
        delete line[key];
      }
    }
    buffer.push(`${JSON.stringify(line)}\n`);
    if (buffer.length >= MAX_BUFFER_ENTRIES) flush();
    else scheduleFlush();
  } catch (err) {
    console.error('[audit] record failed:', err.message);
  }
};

/**
 * Compute the field-level difference between two objects, storing only
 * what actually changed. Used to keep mutation entries small while still
 * making them forensically useful.
 */
export const diff = (before = {}, after = {}) => {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    if (REDACTED_KEYS.has(key.toLowerCase())) continue;
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes[key] = { from: sanitize(from), to: sanitize(to) };
  }
  return changes;
};

/** Flush synchronously — used on shutdown so nothing in flight is lost. */
export const flushSync = () => {
  if (buffer.length === 0) return;
  const payload = buffer.join('');
  buffer = [];
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(currentPath(), payload);
  } catch (err) {
    console.error('[audit] final flush failed:', err.message);
  }
};

/** Close the writer cleanly. Safe to call more than once. */
export const close = async () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushSync();
  if (stream) {
    await new Promise((resolve) => stream.end(resolve));
    stream = null;
  }
  ready = false;
};

export const stats = () => ({
  dir: LOG_DIR,
  ready,
  buffered: buffer.length,
  activeBytes: streamBytes,
  maxFileBytes: MAX_FILE_BYTES,
  maxFiles: MAX_FILES,
});

export default { record, diff, sanitize, flushSync, close, stats, FIELDS };
