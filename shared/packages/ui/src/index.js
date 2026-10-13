/**
 * @printlabs/ui — the design-system layer shared by the storefront and
 * the admin dashboard.
 *
 * This package exists because these files were byte-identical in both
 * applications: 29 component modules plus the class-merging helper and
 * the theme tokens. Two copies of a design system is two design systems,
 * and they drift — a variant fixed in one app stays broken in the other.
 *
 * What belongs here: presentation primitives that carry no knowledge of
 * posters, orders, coupons or any other domain concept. What does not:
 * anything that would need a product decision to change. ProductCard
 * stays in the storefront; Button lives here.
 *
 * Consumers import from the package root. Reaching into
 * `@printlabs/ui/src/components/button` is not supported.
 */
export * from './components/index.js';
