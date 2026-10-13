/**
 * @printlabs/categories — vocabulary shared between the API and the admin
 * dashboard.
 *
 * Scope is deliberately narrow. This is not a home for catalogue
 * business logic: pricing, stock rules and search ranking belong to the
 * API, which owns the catalogue. What lives here is the small set of
 * rules that two applications must read identically or the product
 * misbehaves.
 */
export { splitCategories, normalizeCategories } from './categories.js';
