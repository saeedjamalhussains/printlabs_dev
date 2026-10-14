import Product from '../products/Product.js';
import { splitCategories } from '@printlabs/categories';

/**
 * Follow-up suggestions, rebuilt after every answer.
 *
 * The widget used to show one fixed set of openers for the whole session.
 * Once a customer had asked something, those chips were stale — a
 * "Show Marvel posters" button sitting under a reply about Marvel
 * posters. These are derived from what was actually returned, so the next
 * step is always related to where the conversation just got to.
 *
 * Everything here is either already in memory or one cheap distinct
 * query, so it adds nothing meaningful to response time.
 */

const MAX_SUGGESTIONS = 3;

/**
 * @param {object}   args
 * @param {Array}    args.products  what the answer showed
 * @param {string[]} args.terms     search terms extracted from the query
 * @returns {Promise<string[]>}
 */
export const buildSuggestions = async ({ products = [], terms = [] }) => {
  const asked = new Set(terms.map((t) => t.toLowerCase()));
  const suggestions = [];
  const seen = new Set();

  const add = (text) => {
    const key = text.toLowerCase();
    if (seen.has(key) || suggestions.length >= MAX_SUGGESTIONS) return;
    seen.add(key);
    suggestions.push(text);
  };

  // 1. Sibling categories on the posters just shown. If someone landed on
  //    a Marvel poster tagged "Marvel, Doom", "Doom" is a genuine next
  //    step; "Marvel" is what they already asked for, so it is skipped.
  const shown = new Set();
  for (const product of products) {
    for (const category of splitCategories(product.category)) {
      if (!asked.has(category.toLowerCase())) shown.add(category);
    }
  }
  for (const category of [...shown].slice(0, 2)) add(`More like ${category}`);

  // 2. Price ladder, but only when there is actually something cheaper to
  //    find — offering "under ₹200" on a catalogue whose floor is ₹199
  //    would lead nowhere.
  const prices = products.map((p) => Number(p.price)).filter(Number.isFinite);
  if (prices.length) {
    const cheapest = Math.min(...prices);
    const cheaperExists = await Product.exists({
      isActive: true,
      price: { $lt: cheapest },
    });
    // The old chip named the threshold ("Something under ₹250"), which
    // read like a filter control. The reply shows the cheaper posters
    // anyway, so the number was doing no work the answer does not.
    if (cheaperExists) add('Anything cheaper?');
  }

  // 3. Broaden, using categories the customer has not seen at all. This is
  //    the one query we make, and only when there is room left.
  if (suggestions.length < MAX_SUGGESTIONS) {
    const all = await Product.distinct('category', { isActive: true });
    const unseen = all
      .flatMap(splitCategories)
      .filter((c) => !asked.has(c.toLowerCase()) && !shown.has(c));
    for (const category of [...new Set(unseen)].slice(0, 2)) add(`Got any ${category}?`);
  }

  // 4. A dependable closer, so the row is never empty on a miss.
  add("What's in stock?");

  return suggestions.slice(0, MAX_SUGGESTIONS);
};

export default buildSuggestions;
