/**
 * Shared paging helpers.
 *
 * Every list endpoint is paginated and hard-capped: an unbounded list
 * query is the easiest way to turn one request into hundreds of megabytes
 * of resident memory.
 */

export const parsePaging = (req, { defaultLimit = 25, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const buildPagination = (total, { page, limit }) => ({
  total,
  page,
  pages: Math.max(1, Math.ceil(total / limit)),
  limit,
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

/** Escape a user-supplied string for safe use inside a RegExp. */
export const escapeRegex = (value, maxLength = 100) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, maxLength);
