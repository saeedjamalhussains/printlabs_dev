import { cn } from '../lib/utils';

/**
 * Every page opens the same way: an eyebrow for context, the title, an
 * optional one-line description, and the page's primary action pinned
 * right. Previously each screen built its own header, which is why title
 * sizes and the position of the main action drifted between them.
 *
 * `count` renders beside the title rather than in it — "Orders · 148"
 * tells you the scale of the list before you read a single row.
 */
const PageHeader = ({
  eyebrow,
  title,
  description,
  count,
  actions,
  className,
  ...props
}) => (
  <header
    className={cn(
      'flex flex-col gap-4 border-b border-border pb-5',
      'sm:flex-row sm:items-end sm:justify-between',
      className
    )}
    {...props}
  >
    <div className="flex min-w-0 flex-col gap-1.5">
      {eyebrow && (
        <p className="font-sans text-micro font-semibold uppercase tracking-label text-muted-foreground">
          {eyebrow}
        </p>
      )}

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-xl font-bold uppercase tracking-heading">{title}</h1>
        {count != null && (
          <span className="font-sans text-meta text-muted-foreground [font-variant-numeric:tabular-nums]">
            {count}
          </span>
        )}
      </div>

      {description && (
        <p className="max-w-prose font-sans text-meta leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>

    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export { PageHeader };
