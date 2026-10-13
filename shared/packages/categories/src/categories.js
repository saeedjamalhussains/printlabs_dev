/**
 * How a stored `category` string is split into individual labels.
 *
 * A product holds one or more category labels in a single comma-separated
 * field. Both sides of the system need the same reading of that field:
 * the API canonicalises on write and derives the storefront filter list
 * from it, and the admin form offers the same labels back as
 * autocomplete. When the two disagreed, an administrator could be offered
 * a label the storefront was unable to filter by.
 *
 * This lived in two places — `server/utils/categories.js` and
 * `admin/src/utils/categories.js` — with the admin copy carrying a
 * comment warning that it had to be kept in step by hand. That warning is
 * what made this a shared contract rather than a shared utility: the
 * duplication had a known, documented failure mode.
 *
 * Deliberately dependency-free so it runs unchanged in Node and in the
 * browser.
 */

/**
 * Split a stored category string into its individual labels.
 *
 * Duplicates are dropped case-insensitively, keeping the first spelling
 * seen, so "Marvel, marvel" is one label rather than two filters that
 * look identical on screen.
 *
 * @param {string} value Raw stored category field.
 * @returns {string[]}   Trimmed, de-duplicated labels in first-seen order.
 */
export const splitCategories = (value) => {
  const seen = new Map();

  for (const part of String(value || '').split(',')) {
    const label = part.trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, label);
  }

  return [...seen.values()];
};

/**
 * Canonical storage form: the split labels joined back with a single
 * comma and space, so what is written is always what this module would
 * read back.
 */
export const normalizeCategories = (value) => splitCategories(value).join(', ');
