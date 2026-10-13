import Product from '../products/Product.js';
import { escapeRegex } from '../../utils/pagination.js';

/**
 * Keyword search over the catalogue, used when the AI service is offline.
 *
 * The previous version matched the customer's whole message as a single
 * regex. That works for "marvel" and fails for every way a person
 * actually asks: "show me marvel posters" matched nothing, so the handler
 * fell through to "here are some popular posters" and returned the entire
 * catalogue — including a candle poster — while sounding like it had
 * searched. Silent, and worse than an empty result because it looks
 * deliberate.
 *
 * Matching now happens per meaningful word, and hits are ranked by where
 * they landed and how many words they cover.
 */

// Words that carry no signal in a product query. Kept deliberately small
// — an over-eager list starts eating real search terms.
const STOPWORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'can', 'could', 'do', 'does', 'find',
  'for', 'get', 'give', 'have', 'hello', 'help', 'hey', 'hi', 'how', 'i',
  'in', 'is', 'it', 'like', 'looking', 'me', 'my', 'need', 'of', 'on',
  'or', 'please', 'poster', 'posters', 'print', 'prints', 'recommend',
  'search', 'see', 'show', 'some', 'something', 'suggest', 'that', 'the',
  'their', 'there', 'these', 'they', 'this', 'to', 'want', 'was', 'what',
  'which', 'with', 'would', 'you', 'your',
]);

/** Meaningful search terms from a natural-language message. */
export const tokenize = (query) => {
  const words = String(query).toLowerCase().match(/[a-z0-9]+/g) || [];
  const terms = words.filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // If stripping stopwords left nothing ("show me posters"), fall back to
  // the raw words so a search still happens rather than silently widening
  // to the whole catalogue.
  return terms.length ? [...new Set(terms)] : [...new Set(words.filter((w) => w.length > 2))];
};

// A title hit is a stronger signal than a description hit; a term that
// appears in several fields should outrank one that appears in a single
// long description.
const FIELD_WEIGHTS = { title: 5, category: 3, description: 1 };

const scoreProduct = (product, terms) => {
  let score = 0;
  let matchedTerms = 0;

  for (const term of terms) {
    let termScore = 0;
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const value = String(product[field] || '').toLowerCase();
      if (!value.includes(term)) continue;
      // An exact word beats a substring, so "art" does not rank a match
      // inside "cartoon" as highly as a real occurrence of the word.
      const exactWord = new RegExp(`\\b${escapeRegex(term)}\\b`).test(value);
      termScore += weight * (exactWord ? 2 : 1);
    }
    if (termScore > 0) {
      matchedTerms += 1;
      score += termScore;
    }
  }

  // Covering more of what was asked matters more than one strong field.
  return matchedTerms > 0 ? score + matchedTerms * 10 : 0;
};

/**
 * Find posters matching a natural-language query.
 *
 * @returns {Promise<{products: Array, matched: boolean, terms: string[]}>}
 *          `matched` distinguishes a real result from the popular-items
 *          fallback, so the reply can say which one it is.
 */
export const searchCatalogue = async (query, { limit = 4, fields } = {}) => {
  const terms = tokenize(query);

  if (terms.length) {
    const patterns = terms.map((t) => new RegExp(escapeRegex(t), 'i'));
    const candidates = await Product.find({
      isActive: true,
      $or: [
        { title: { $in: patterns } },
        { category: { $in: patterns } },
        { description: { $in: patterns } },
      ],
    })
      .select(`${fields} description`)
      .limit(50) // rank a bounded candidate set, not the whole catalogue
      .lean();

    const ranked = candidates
      .map((product) => ({ product, score: scoreProduct(product, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.product);

    if (ranked.length) return { products: ranked, matched: true, terms };
  }

  // Nothing matched. Suggest something buyable rather than an empty row.
  const popular = await Product.find({ isActive: true, stock: { $gt: 0 } })
    .select(fields)
    .sort('-createdAt')
    .limit(limit)
    .lean();

  return { products: popular, matched: false, terms };
};
