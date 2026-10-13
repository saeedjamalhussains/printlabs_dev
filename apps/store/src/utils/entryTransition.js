/**
 * A one-shot marker for "this person has just signed in or signed up".
 *
 * The entry animation must play exactly once, at the moment someone comes
 * through authentication into the product — and never on an ordinary
 * visit to the home page, a refresh, or a return from another page.
 *
 * That state is deliberately held in a module variable rather than in
 * route state, sessionStorage or a mount check, and the reason is that
 * this variable has precisely the lifetime the animation needs:
 *
 *   - Route state (`navigate('/', { state })`) is stored in history, so
 *     it survives a refresh and replays the animation. It also comes back
 *     when the entry is reached again with the back button.
 *   - sessionStorage outlives the tab-load entirely, which is worse.
 *   - "Did Home just mount?" is true on every visit to Home, which is the
 *     specific thing this must not do.
 *
 * A module variable is created fresh on page load and cleared the instant
 * it is read, so it can only ever describe the navigation that happens
 * immediately after authentication succeeds, in this document.
 */
let pendingEntry = false;

/** Called on successful sign-in / sign-up, immediately before navigating. */
export const markAuthenticatedEntry = () => {
  pendingEntry = true;
};

/**
 * Reads the marker and clears it in the same breath, so a second caller —
 * or a second render of the same caller — gets false.
 */
export const consumeAuthenticatedEntry = () => {
  const wasPending = pendingEntry;
  pendingEntry = false;
  return wasPending;
};
