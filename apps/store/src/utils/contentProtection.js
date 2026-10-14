/**
 * Casual-copying deterrents for the storefront.
 *
 * ── What this is worth ──────────────────────────────────────────────
 * These are speed bumps, not security. A browser cannot be prevented
 * from saving a page it has already been sent: the images are in the
 * HTTP cache, the menu bar's "Save Page As" is not scriptable, devtools
 * and `curl` do not run this code at all, and a screenshot bypasses
 * every one of these regardless.
 *
 * They are worth installing because they stop the accidental and the
 * idle — the right-click-save reflex — which is most of it. They are not
 * worth mistaking for protection.
 *
 * The protection that actually holds is upstream and already in place:
 * apps/server/features/images/uploadPresets.js stores every upload at 800px and quality
 * 20, so the full-resolution original is never delivered to a browser.
 * If more is needed, it belongs on the delivery side (a watermark, or
 * signed expiring Cloudinary URLs), not here.
 *
 * ── Deliberate carve-outs ───────────────────────────────────────────
 * Form fields keep their context menu. Taking it away costs paste,
 * spell-check, autofill and the whole right-click vocabulary people rely
 * on to type an address, and it protects nothing — there is no artwork
 * inside a text input.
 *
 * Devtools shortcuts are NOT blocked. Blocking F12 stops nobody who
 * wants the file (the menu still opens it, and so does the network tab
 * that already has the image), while breaking the browser for anyone
 * who has a real reason to open it.
 */

/** Right-click inside these keeps the native menu. */
const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

const isEditable = (target) =>
  target instanceof Element && target.closest(EDITABLE) !== null;

const onContextMenu = (event) => {
  if (isEditable(event.target)) return;
  event.preventDefault();
};

const onDragStart = (event) => {
  // Images already have `-webkit-user-drag: none`, but that is a WebKit
  // property; Firefox honours only the event.
  if (event.target instanceof Element && event.target.closest('img')) {
    event.preventDefault();
  }
};

const onKeyDown = (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;

  const key = event.key.toLowerCase();

  // Ctrl/Cmd+S — "Save Page As". Preventable in-page; the equivalent
  // menu item is not, so this is partial by nature.
  // Ctrl/Cmd+P — the print dialog still opens if the browser wants it
  // to, but @media print in index.css strips the artwork either way.
  if (key === 's' || key === 'p') {
    // Never swallow a save inside a form field — some browsers surface
    // Ctrl+S to page-level handlers even while typing.
    if (isEditable(event.target)) return;
    event.preventDefault();
  }
};

/**
 * Install the deterrents. Returns a teardown so a test or a future
 * admin-only view can lift them.
 */
export const installContentProtection = () => {
  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('dragstart', onDragStart);
  document.addEventListener('keydown', onKeyDown);

  return () => {
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('dragstart', onDragStart);
    document.removeEventListener('keydown', onKeyDown);
  };
};

export default installContentProtection;
