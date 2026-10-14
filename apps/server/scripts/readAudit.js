/**
 * Read the blackbox from the command line.
 *
 *   npm run audit                          # last 50 entries
 *   npm run audit -- --limit 200
 *   npm run audit -- --action admin.order.refund
 *   npm run audit -- --actor you@example.com
 *   npm run audit -- --failed               # only non-2xx outcomes
 *   npm run audit -- --archived --json
 *
 * Streams line-by-line so a large archive never has to be held in memory
 * all at once.
 */

import env from '../config/env.js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';

const LOG_DIR = env.AUDIT_LOG_DIR || path.join(process.cwd(), 'logs', 'audit');

const parseArgs = () => {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
};

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const format = (e) => {
  const when = new Date(e.ts).toISOString().replace('T', ' ').slice(0, 19);
  const ok = e.ok !== false;
  const status = `${ok ? GREEN : RED}${e.st ?? '—'}${RESET}`;
  const actor = e.eml || e.usr || 'anonymous';
  const target = e.tgt ? ` ${DIM}→${RESET} ${e.tgt}` : '';
  const changes = e.chg && Object.keys(e.chg).length ? `\n    ${DIM}${JSON.stringify(e.chg)}${RESET}` : '';
  const error = e.err ? `\n    ${RED}${e.err}${RESET}` : '';
  return `${DIM}${when}${RESET} ${status} ${BOLD}${e.act}${RESET}${target}` +
         `\n    ${DIM}by${RESET} ${actor} ${DIM}from${RESET} ${e.ip || '?'} ${DIM}in${RESET} ${e.ms ?? '?'}ms ${DIM}rid${RESET} ${e.rid || '—'}` +
         changes + error;
};

const collectFrom = async (stream, matches, filters, limit) => {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (filters.action && entry.act !== filters.action) continue;
    if (filters.actor && entry.eml !== filters.actor && entry.usr !== filters.actor) continue;
    if (filters.failed && entry.ok !== false) continue;
    matches.push(entry);
    // Keep only the newest `limit` entries so memory stays bounded.
    if (matches.length > limit * 2) matches.splice(0, matches.length - limit);
  }
  rl.close();
};

const run = async () => {
  const args = parseArgs();
  const limit = Number(args.limit) || 50;
  const filters = { action: args.action, actor: args.actor, failed: Boolean(args.failed) };

  if (!fs.existsSync(LOG_DIR)) {
    console.log(`No audit log yet at ${LOG_DIR}`);
    return;
  }

  const matches = [];

  if (args.archived) {
    const archives = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.gz'))
      .sort();
    for (const file of archives) {
      await collectFrom(
        fs.createReadStream(path.join(LOG_DIR, file)).pipe(zlib.createGunzip()),
        matches, filters, limit
      );
    }
  }

  const active = path.join(LOG_DIR, 'audit.jsonl');
  if (fs.existsSync(active)) {
    await collectFrom(fs.createReadStream(active), matches, filters, limit);
  }

  const shown = matches.slice(-limit);

  if (args.json) {
    console.log(JSON.stringify(shown, null, 2));
    return;
  }

  if (shown.length === 0) {
    console.log('No matching entries.');
    return;
  }

  for (const entry of shown) console.log(format(entry), '\n');
  console.log(`${DIM}${shown.length} entr${shown.length === 1 ? 'y' : 'ies'} from ${LOG_DIR}${RESET}`);
};

run().catch((err) => {
  console.error('Failed to read audit log:', err.message);
  process.exit(1);
});
