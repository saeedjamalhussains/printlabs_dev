/**
 * Admin console logger.
 *
 * Standardised, colour-tagged console output so an operator (or
 * support) can see every UX action and API call at a glance in the
 * browser DevTools console.
 *
 *   log.auth   ('Login submitted', { email })
 *   log.api    ('GET /orders → 200', { count: 12 })
 *   log.action ('Status change', { orderId, from, to })
 *   log.nav    ('Routed to /products')
 *   log.warn   ('Cloudinary usage unavailable on plan')
 *   log.error  ('Refund failed', err)
 *
 * Override via localStorage: `localStorage.setItem('logLevel','silent')`
 * silences everything for live demos.
 */

const LEVELS = ['silent', 'error', 'warn', 'info', 'debug'];
const currentLevel = () => {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem('logLevel')) || 'debug';
  return LEVELS.indexOf(v) === -1 ? 'debug' : v;
};
const should = (atLeast) => LEVELS.indexOf(currentLevel()) >= LEVELS.indexOf(atLeast);

const stamp = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

// Each category gets a label, a min-level gate, and a colour for the
// "%c" CSS pill rendered in the DevTools console.
const CATEGORIES = {
  auth:   { label: 'AUTH',   at: 'info',  css: 'background:#1e3a5f;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600;' },
  api:    { label: 'API',    at: 'debug', css: 'background:#374151;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600;' },
  action: { label: 'ACTION', at: 'info',  css: 'background:#052e16;color:#6ee7b7;padding:2px 6px;border-radius:3px;font-weight:600;' },
  nav:    { label: 'NAV',    at: 'info',  css: 'background:#1e1b4b;color:#a5b4fc;padding:2px 6px;border-radius:3px;font-weight:600;' },
  data:   { label: 'DATA',   at: 'debug', css: 'background:#451a03;color:#fcd34d;padding:2px 6px;border-radius:3px;font-weight:600;' },
};

const emit = (cat, level, msg, payload) => {
  const def = CATEGORIES[cat];
  if (!def || !should(def.at)) return;
  const out = console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'];
  const args = [`%c${def.label}%c  ${stamp()}  ${msg}`, def.css, ''];
  if (payload !== undefined) args.push(payload);
  out(...args);
};

const log = {
  auth:   (msg, payload) => emit('auth',   'info',  msg, payload),
  api:    (msg, payload) => emit('api',    'log',   msg, payload),
  action: (msg, payload) => emit('action', 'info',  msg, payload),
  nav:    (msg, payload) => emit('nav',    'info',  msg, payload),
  data:   (msg, payload) => emit('data',   'log',   msg, payload),
  warn:   (msg, payload) => {
    if (!should('warn')) return;
    const args = [`%cWARN%c  ${stamp()}  ${msg}`, 'background:#451a03;color:#fcd34d;padding:2px 6px;border-radius:3px;font-weight:600;', ''];
    if (payload !== undefined) args.push(payload);
    console.warn(...args);
  },
  error: (msg, payload) => {
    if (!should('error')) return;
    const args = [`%cERROR%c  ${stamp()}  ${msg}`, 'background:#7f1d1d;color:#fee2e2;padding:2px 6px;border-radius:3px;font-weight:600;', ''];
    if (payload !== undefined) args.push(payload);
    console.error(...args);
  },
};

// Banner so anyone opening DevTools immediately understands what they're
// looking at and how to silence it.
export const banner = () => {
  console.log(
    '%cThePrintLabs — Admin Console%c\n' +
    'All UX actions and API calls are traced here for operator visibility.\n' +
    'To silence:  localStorage.setItem("logLevel","silent"); location.reload()',
    'font-family:Playfair Display,serif;font-size:14px;font-weight:700;letter-spacing:0.05em;color:#000;background:#fff;padding:6px 12px;border-radius:3px;',
    'color:#888;font-size:11px;line-height:1.5;'
  );
};

export default log;
