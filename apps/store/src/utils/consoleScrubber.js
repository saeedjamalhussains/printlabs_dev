// Hides third-party noise from our window.console output.
//
// Razorpay's checkout iframe (cross-origin) emits its own warnings,
// failed analytics requests (lumberjack / sentry / sardine blocked by
// ad-blockers), and browser interventions (navigator.vibrate, unsafe
// headers). Those messages live in the iframe's own JS context and
// CANNOT be intercepted from here — they only show up in the user's
// DevTools because Chrome merges every frame's console into one view.
//
// What we CAN do is make sure nothing in our own code (or any third
// party that goes through window.console) adds to that noise. We
// patch the four common console methods and drop any call whose text
// matches a noise pattern.
//
// Production-only: in dev we want everything visible.

const NOISE_PATTERNS = [
  /razorpay/i,
  /lumberjack/i,
  /sardine/i,
  /sentry-cdn/i,
  /otp-credentials/i,
  /x-rtb-fingerprint-id/i,
  /request-id/i,
  /navigator\.vibrate/i,
  /willReadFrequently/i,
  /preloaded.*not used/i,
  /ERR_BLOCKED_BY_CLIENT/i,
];

const messageMatches = (args) => {
  for (const a of args) {
    const s = typeof a === 'string' ? a : a && a.message ? a.message : '';
    if (s && NOISE_PATTERNS.some((re) => re.test(s))) return true;
  }
  return false;
};

export const installConsoleScrubber = () => {
  if (import.meta.env.DEV) return; // keep dev logs intact

  const methods = ['log', 'warn', 'error', 'info', 'debug'];
  for (const m of methods) {
    const orig = console[m].bind(console);
    console[m] = (...args) => {
      if (messageMatches(args)) return; // swallow
      orig(...args);
    };
  }
};
