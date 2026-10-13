import { cn } from '../lib/utils';
import { Button } from './button';

/**
 * The shared answer to a blank screen. Three parts, in this order:
 * what this list is, why it is empty, and the one thing to do next.
 *
 * `variant="search"` is for "your filters matched nothing", which is a
 * different situation from "you have none of these yet" — the first needs
 * a way back out of the filters, the second needs a way to begin.
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
  className,
  ...props
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
      className
    )}
    {...props}
  >
    {Icon && (
      // A thin outline glyph at low contrast: present enough to anchor the
      // block, quiet enough not to compete with the message.
      <Icon className="size-7 opacity-25" strokeWidth={1.25} aria-hidden="true" />
    )}

    <h3 className="font-serif text-md font-bold uppercase tracking-heading">{title}</h3>

    {description && (
      <p className="max-w-sm font-sans text-meta leading-relaxed text-muted-foreground">
        {description}
      </p>
    )}

    {(action || secondaryAction) && (
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {action && (
          <Button onClick={action} size="sm">
            {actionLabel}
          </Button>
        )}
        {secondaryAction && (
          <Button onClick={secondaryAction} size="sm" variant="ghost">
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    )}
  </div>
);

export { EmptyState };
