import { useCallback, useEffect, useRef } from 'react';

/**
 * Make a grid item span exactly as many rows as its own content needs.
 *
 * The grid is given a small `grid-auto-rows` unit; each card then spans
 * however many of those units it takes up. The result reads as masonry
 * while staying a real grid, which matters because the CSS alternative
 * (`column-count`) fills each column top-to-bottom before starting the
 * next — so a price-sorted list would run down the first column instead
 * of across the row, which is not the order the customer asked for.
 *
 * The row unit and gap are read from the parent's computed style rather
 * than duplicated here, so the media queries in the page CSS stay the
 * single source of truth for spacing.
 */
export const useMasonrySpan = () => {
  const ref = useRef(null);
  const lastSpan = useRef(null);

  const recalculate = useCallback(() => {
    const el = ref.current;
    const grid = el?.parentElement;
    if (!el || !grid) return;

    const gridStyle = getComputedStyle(grid);
    // A grid that is not in masonry mode (the mobile single-column
    // layouts) reports `auto`; leave those alone entirely.
    const row = parseFloat(gridStyle.gridAutoRows);
    if (!Number.isFinite(row) || row <= 0) {
      if (lastSpan.current !== null) {
        lastSpan.current = null;
        el.style.removeProperty('--row-span');
      }
      return;
    }

    const gap = parseFloat(gridStyle.rowGap) || 0;

    // The card's own bottom margin is what separates it from the card
    // below, so it counts towards the space the card occupies.
    // getBoundingClientRect excludes margin and keeps the sub-pixel
    // height, which ceil() then rounds up — a floor would clip the last
    // line of the title.
    const margin = parseFloat(getComputedStyle(el).marginBottom) || 0;
    const height = el.getBoundingClientRect().height + margin;

    const span = Math.max(1, Math.ceil((height + gap) / (row + gap)));

    // Writing the span changes `grid-row`, which resizes the item's grid
    // area, which wakes the ResizeObserver that called us. Without this
    // guard that is an infinite loop: it runs away and every card ends
    // up on the tallest card's span, which is the bug this replaced.
    if (span === lastSpan.current) return;
    lastSpan.current = span;
    el.style.setProperty('--row-span', span);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    recalculate();

    // Only the card itself is observed. Anything that changes its height
    // — the image arriving, a narrower column on resize, a font swap
    // reflowing the title — changes this box. Observing the grid as well
    // would mean every card woke every other card, since one card's span
    // changes the grid's total height.
    const observer = new ResizeObserver(recalculate);
    observer.observe(el);

    return () => observer.disconnect();
  }, [recalculate]);

  return { ref, recalculate };
};
