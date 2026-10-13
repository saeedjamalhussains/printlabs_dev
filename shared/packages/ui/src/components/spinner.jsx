import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * For indeterminate waits where no content shape is known. Prefer a
 * Skeleton whenever the shape *is* known — replacing a known layout with
 * a spinner throws away information the user could already be reading.
 *
 * `label` is required in spirit: a spinner with no accessible name is
 * silent to a screen reader.
 */
const Spinner = ({ className, label = 'Loading', size = 16 }) => (
  <span role="status" className={cn('inline-flex items-center gap-2', className)}>
    <LoaderCircle
      size={size}
      aria-hidden="true"
      className="animate-[tpl-spin_0.7s_linear_infinite]"
    />
    <span className="sr-only">{label}</span>
  </span>
);

export { Spinner };
