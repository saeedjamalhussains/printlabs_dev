/**
 * Category taxonomy helpers for the API.
 *
 * The rule for *reading* a category field is shared with the admin
 * dashboard and lives in @printlabs/categories — both applications have to
 * agree on it or an administrator can save a label the storefront cannot
 * filter by. It is re-exported here so the existing call sites inside
 * this application keep working and keep reading naturally.
 *
 * What stays in the API is the part only the API can own: turning a
 * label into a database query. That is Mongo-specific and has no meaning
 * in a browser.
 */

import { escapeRegex } from './pagination.js';

export { splitCategories, normalizeCategories } from '@printlabs/categories';

/**
 * A Mongo condition matching every product carrying `label`.
 *
 * Anchored to comma boundaries rather than a bare substring: a plain
 * /Doom/ would also match a "Doomsday" category, and an exact-string
 * match would miss the "Marvel, Doom" products entirely — which is the
 * bug this replaces.
 */
export const categoryCondition = (label) => {
  const escaped = escapeRegex(String(label).trim());
  if (!escaped) return null;
  return { category: { $regex: `(^|,\\s*)${escaped}(\\s*,|$)`, $options: 'i' } };
};
