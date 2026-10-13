import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './button';

/**
 * Build a compact page list: first, last, the current page and its
 * neighbours, with gaps collapsed to an ellipsis. Returning '…' entries
 * rather than rendering them inline keeps the component readable.
 */
const pageItems = (page, total, span = 1) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items = new Set([1, total]);
  for (let p = page - span; p <= page + span; p += 1) {
    if (p > 1 && p < total) items.add(p);
  }

  const sorted = [...items].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
};

/**
 * Pagination with a stated range. The "Showing 21–40 of 148" line is the
 * part people actually use to orient themselves — page numbers alone do
 * not say how much is left.
 */
const Pagination = ({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
  ...props
}) => {
  if (!totalPages || totalPages < 1) return null;

  const items = pageItems(page, totalPages);
  const from = totalItems != null && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = totalItems != null && pageSize ? Math.min(page * pageSize, totalItems) : null;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col-reverse items-center gap-4 border-t border-border pt-4',
        'sm:flex-row sm:justify-between',
        className
      )}
      {...props}
    >
      {from != null ? (
        <p className="font-sans text-meta text-muted-foreground [font-variant-numeric:tabular-nums]">
          Showing {from}–{to} of {totalItems}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        {items.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              // aria-current is what tells a screen reader which page this
              // is; the border is the visual half of the same fact.
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'inline-flex size-9 items-center justify-center border',
                'font-sans text-meta [font-variant-numeric:tabular-nums]',
                'transition-colors duration-120 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                item === page
                  ? 'border-primary bg-primary text-primary-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground'
              )}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              aria-hidden="true"
              className="inline-flex size-9 items-center justify-center text-meta text-muted-foreground"
            >
              …
            </span>
          )
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
};

export { Pagination };
