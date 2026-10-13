/**
 * aiSync.js — tells the FastAPI AI service to re-index the catalogue when
 * products change.
 *
 * Non-blocking by design: if the AI service is offline the product write
 * still succeeds and the chatbot falls back to keyword search.
 *
 * Requests are coalesced. A re-index is a *whole catalogue* operation —
 * it re-fetches every product and re-embeds all of them — so firing one
 * per write meant editing twenty products in the admin queued twenty full
 * rebuilds, each one throwing away the work of the last. Bursts now
 * collapse into a single rebuild shortly after the burst ends.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'printlabs_secret_internal_key_2026';

// How long to wait for the burst to settle before rebuilding. Long enough
// to absorb a person clicking through several products, short enough that
// a single edit shows up in the chatbot almost immediately.
const DEBOUNCE_MS = Number(process.env.AI_REINDEX_DEBOUNCE_MS) || 2000;

// Upper bound on a continuous stream of writes (a bulk import), so the
// index cannot be starved indefinitely by a debounce that keeps resetting.
const MAX_DELAY_MS = Number(process.env.AI_REINDEX_MAX_DELAY_MS) || 15000;

// Abort a re-index request that never answers, so a wedged AI service
// cannot leave `inFlight` stuck and block every future sync.
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REINDEX_TIMEOUT_MS) || 60000;

let timer = null;
let firstQueuedAt = null;
let pendingReasons = new Set();
let inFlight = false;
let queuedWhileInFlight = false;

const send = async (reasons) => {
  inFlight = true;
  const label = [...reasons].join(', ') || 'product_mutation';
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/v1/reindex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': INTERNAL_API_KEY,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      console.info(`[aiSync] Re-indexed (${label}) — ${body.indexed_count ?? '?'} products.`);
    } else {
      console.warn(`[aiSync] Re-index returned ${res.status} (${label}).`);
    }
  } catch (err) {
    const why = err.name === 'TimeoutError' ? 'timed out' : err.message;
    console.warn(`[aiSync] Re-index skipped — AI service ${why} (${label}).`);
  } finally {
    inFlight = false;
    // Writes that landed mid-rebuild are not in the index we just built,
    // so run once more rather than losing them.
    if (queuedWhileInFlight) {
      queuedWhileInFlight = false;
      triggerReindex('coalesced_followup');
    }
  }
};

const flush = () => {
  clearTimeout(timer);
  timer = null;
  firstQueuedAt = null;

  const reasons = pendingReasons;
  pendingReasons = new Set();

  if (inFlight) {
    queuedWhileInFlight = true;
    return;
  }
  send(reasons);
};

/**
 * Queue a catalogue re-index. Safe to call on every product write.
 *
 * @param {string} [reason] label for the log line, e.g. 'createProduct'
 */
export function triggerReindex(reason = 'product_mutation') {
  pendingReasons.add(reason);
  if (firstQueuedAt === null) firstQueuedAt = Date.now();

  // Cap the total wait so a steady stream of writes still gets indexed.
  const waited = Date.now() - firstQueuedAt;
  if (waited >= MAX_DELAY_MS) {
    flush();
    return;
  }

  clearTimeout(timer);
  timer = setTimeout(flush, Math.min(DEBOUNCE_MS, MAX_DELAY_MS - waited));
  // Do not hold the process open for a pending re-index.
  timer.unref?.();
}

export default triggerReindex;
