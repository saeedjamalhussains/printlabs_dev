/**
 * Money arithmetic.
 *
 * Every amount in this system is rupees, and rupees are not exactly
 * representable in binary floating point. Accumulating them directly
 * produces values that are correct to display but wrong to store:
 *
 *   1099.90 * 3 + 549.95        === 3849.6500000000005
 *   3849.6500000000005 - 3464.65 === 385.00000000000045
 *
 * The amount charged was never affected — it goes through Math.round on
 * the way to paise — but the discount recorded against the order was the
 * raw subtraction, so orders persisted figures that did not reconcile.
 *
 * The rule here: do arithmetic in integer paise, convert to rupees only
 * at the boundary. Paise is the currency's smallest unit, so an integer
 * count of them is exact.
 */

/** Rupees → integer paise. The rounding boundary for all money. */
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);

/**
 * Integer paise → rupees.
 *
 * The division can still land on a value like 3464.6500000000001, so the
 * result is re-quantised to two decimals. Number() strips the trailing
 * zeros toFixed leaves behind.
 */
export const toRupees = (paise) => Number((Math.round(Number(paise)) / 100).toFixed(2));

/** Quantise a rupee amount to whole paise. */
export const roundRupees = (rupees) => toRupees(toPaise(rupees));
