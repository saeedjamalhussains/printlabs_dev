import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../lib/utils';

/* For operations with a knowable extent — an upload, a batch. A 2px ink
   rule filling a hairline track; determinate progress is preferred over a
   spinner wherever a total is actually available. */
const Progress = ({ className, value = 0, label, ...props }) => (
  <ProgressPrimitive.Root
    value={value}
    aria-label={label}
    className={cn('relative h-0.5 w-full overflow-hidden bg-muted', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full bg-primary transition-transform duration-320 ease-out"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);

export { Progress };
