import { cn } from '../lib/utils';

/**
 * Table primitives tuned for scanning rather than for space.
 *
 * Density is kept deliberately tight — the admin's tables are the working
 * surface of the product and making them airy "to look modern" would mean
 * fewer orders visible per screen, which is a real cost to whoever is
 * packing them.
 *
 * TableWrap is not optional: it is the horizontal scroll container. A wide
 * table must scroll inside its own box, never push the page sideways.
 */
const TableWrap = ({ className, ...props }) => (
  <div
    className={cn('w-full overflow-x-auto border border-border', className)}
    {...props}
  />
);

const Table = ({ className, ...props }) => (
  <table
    className={cn('w-full caption-bottom border-collapse font-sans text-meta', className)}
    {...props}
  />
);

const TableHeader = ({ className, ...props }) => (
  <thead className={cn('border-b border-border-strong', className)} {...props} />
);

const TableBody = ({ className, ...props }) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);

const TableFooter = ({ className, ...props }) => (
  <tfoot className={cn('border-t border-border-strong font-semibold', className)} {...props} />
);

const TableRow = ({ className, ...props }) => (
  <tr
    className={cn(
      'border-b border-border transition-colors duration-120 ease-out',
      'hover:bg-muted data-[state=selected]:bg-accent',
      className
    )}
    {...props}
  />
);

/**
 * Column head. `align="right"` is for numeric columns — figures are read
 * by comparing digits, which only works when they share a right edge.
 */
const TableHead = ({ className, align = 'left', ...props }) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap px-3 py-2.5 font-semibold uppercase tracking-label',
      'text-micro text-muted-foreground',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      align === 'left' && 'text-left',
      className
    )}
    {...props}
  />
);

const TableCell = ({ className, align = 'left', numeric = false, ...props }) => (
  <td
    className={cn(
      'px-3 py-2.5 align-middle text-foreground',
      // Tabular figures so columns of numbers line up digit for digit.
      numeric && 'text-right [font-variant-numeric:tabular-nums]',
      !numeric && align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className
    )}
    {...props}
  />
);

const TableCaption = ({ className, ...props }) => (
  <caption className={cn('mt-3 text-meta text-muted-foreground', className)} {...props} />
);

/**
 * Row of skeletons shaped like the table, for first load. Keeping the
 * header and the row rhythm on screen means the page does not jump when
 * the data arrives.
 */
const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <tbody aria-hidden="true">
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="border-b border-border">
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c} className="px-3 py-2.5">
            <div
              className="h-3 bg-muted animate-[tpl-pulse_1.6s_ease-in-out_infinite]"
              style={{
                // Varied widths read as text; identical bars read as a grid.
                width: `${[70, 45, 60, 35, 50, 80][(r + c) % 6]}%`,
                animationDelay: `${(r * cols + c) * 25}ms`,
              }}
            />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

export {
  TableWrap, Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell, TableCaption, TableSkeleton,
};
