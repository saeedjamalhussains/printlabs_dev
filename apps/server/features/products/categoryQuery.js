import { escapeRegex } from '../../utils/pagination.js';

export const categoryCondition = (label) => {
  const escaped = escapeRegex(String(label).trim());
  if (!escaped) return null;
  return { category: { $regex: `(^|,\\s*)${escaped}(\\s*,|$)`, $options: 'i' } };
};