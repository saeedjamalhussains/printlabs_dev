/**
 * Audit log reader — exposes the on-disk blackbox to the admin dashboard.
 *
 * The log is append-only JSONL, so reading it is a tail rather than a
 * query. To keep memory flat regardless of file size, only the last
 * TAIL_BYTES of the active file are read, newest-first, and scanning
 * stops as soon as enough matching entries have been collected.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { stats as auditStats, FIELDS } from '../../utils/auditLog.js';

const LOG_DIR = process.env.AUDIT_LOG_DIR || path.join(process.cwd(), 'logs', 'audit');
const TAIL_BYTES = 4 * 1024 * 1024; // never hold more than 4MB of log in memory
const MAX_LIMIT = 500;

/** Read at most the final `bytes` of a file, without loading the whole thing. */
const readTail = (file, bytes) => {
  const { size } = fs.statSync(file);
  const start = Math.max(0, size - bytes);
  const fd = fs.openSync(file, 'r');
  try {
    const length = size - start;
    const buffer = Buffer.allocUnsafe(length);
    fs.readSync(fd, buffer, 0, length, start);
    const text = buffer.toString('utf8');
    // A non-zero offset almost certainly lands mid-line; drop the partial.
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    fs.closeSync(fd);
  }
};

/** Expand short on-disk keys into readable field names for the UI. */
const expand = (entry) => {
  const out = {};
  for (const [key, value] of Object.entries(entry)) {
    out[FIELDS[key] || key] = value;
  }
  return out;
};

// @desc    List recent audit entries, newest first
// @route   GET /api/admin/audit
export const listAuditLog = asyncHandler(async (req, res) => {
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const { action, actor, from, to, includeArchived } = req.query;

  const fromTime = from ? new Date(from).getTime() : null;
  const toTime = to ? new Date(to).getTime() : null;

  const sources = [];
  const active = path.join(LOG_DIR, 'audit.jsonl');
  if (fs.existsSync(active)) sources.push(() => readTail(active, TAIL_BYTES));

  // Archives are only touched when explicitly requested — decompressing
  // them is far more expensive than tailing the active file.
  if (includeArchived === 'true' && fs.existsSync(LOG_DIR)) {
    const archives = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.gz'))
      .sort()
      .reverse()
      .slice(0, 5);
    for (const file of archives) {
      sources.push(() => zlib.gunzipSync(fs.readFileSync(path.join(LOG_DIR, file))).toString('utf8'));
    }
  }

  const matches = [];
  let scanned = 0;

  // Newest source first, and within a source scan bottom-up.
  outer: for (const load of sources) {
    let lines;
    try {
      lines = load().split('\n');
    } catch {
      continue; // a mid-rotation read can fail; skip that source
    }

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!line) continue;
      scanned += 1;

      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // torn final line
      }

      if (action && entry.act !== action) continue;
      if (actor && entry.usr !== actor && entry.eml !== actor) continue;
      if (fromTime || toTime) {
        const at = new Date(entry.ts).getTime();
        if (fromTime && at < fromTime) continue;
        if (toTime && at > toTime) continue;
      }

      matches.push(expand(entry));
      if (matches.length >= limit) break outer;
    }
  }

  res.status(200).json({
    success: true,
    data: { entries: matches, scanned, limit, hasMore: matches.length === limit },
  });
});

// @desc    Audit sink health and disk footprint
// @route   GET /api/admin/audit/stats
export const getAuditStats = asyncHandler(async (req, res) => {
  const base = auditStats();

  let archiveCount = 0;
  let archiveBytes = 0;
  if (fs.existsSync(LOG_DIR)) {
    for (const file of fs.readdirSync(LOG_DIR)) {
      if (file.startsWith('audit-') && file.endsWith('.gz')) {
        archiveCount += 1;
        archiveBytes += fs.statSync(path.join(LOG_DIR, file)).size;
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...base,
      archiveCount,
      archiveBytes,
      totalBytes: base.activeBytes + archiveBytes,
      // Worst-case disk use before the oldest archive is pruned.
      ceilingBytes: base.maxFileBytes * (base.maxFiles + 1),
    },
  });
});
