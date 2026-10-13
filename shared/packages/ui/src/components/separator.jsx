import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '../lib/utils';

/* A rule is the main structural device in this design, so it gets a
   component: hairline by default, `strong` for a section break. */
const Separator = ({ className, orientation = 'horizontal', strong = false, ...props }) => (
  <SeparatorPrimitive.Root
    decorative
    orientation={orientation}
    className={cn(
      'shrink-0',
      strong ? 'bg-border-strong' : 'bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
);

export { Separator };
