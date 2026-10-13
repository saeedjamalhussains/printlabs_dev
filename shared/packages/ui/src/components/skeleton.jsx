import { cn } from '../lib/utils';

/**
 * Content-shaped placeholder. The rule for using it: a skeleton should
 * occupy the same box the real content will, so the page does not relayout
 * when data lands. Where the shape is not known, prefer a text status over
 * an invented shape.
 *
 * The pulse is opacity-only and is flattened by the global
 * prefers-reduced-motion block.
 */
const Skeleton = ({ className, ...props }) => (
  <div
    aria-hidden="true"
    className={cn('bg-muted animate-[tpl-pulse_1.6s_ease-in-out_infinite]', className)}
    {...props}
  />
);

/** A paragraph of skeleton lines, last one short so it reads as prose. */
const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn('flex flex-col gap-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn('h-3', i === lines - 1 ? 'w-2/5' : 'w-full')}
      />
    ))}
  </div>
);

export { Skeleton, SkeletonText };
