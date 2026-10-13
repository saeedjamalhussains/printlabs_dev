import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../lib/utils';

/* Used where a pane scrolls inside the page (a sidebar, a long menu) so
   the thumb matches the app instead of the OS. */
const ScrollArea = ({ className, children, ...props }) => (
  <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="size-full">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollBar orientation="horizontal" />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);

const ScrollBar = ({ className, orientation = 'vertical', ...props }) => (
  <ScrollAreaPrimitive.Scrollbar
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-opacity duration-200 ease-out',
      orientation === 'vertical' ? 'h-full w-1.5 p-px' : 'h-1.5 flex-col p-px',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb className="relative flex-1 bg-[var(--scrollbar-thumb)] opacity-40" />
  </ScrollAreaPrimitive.Scrollbar>
);

export { ScrollArea, ScrollBar };
