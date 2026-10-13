import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../lib/utils';

/* Underline tabs — the indicator is a rule, consistent with how the rest
   of the app marks the active thing. Arrow-key navigation and the
   tab/panel wiring come from Radix. */
const Tabs = TabsPrimitive.Root;

const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List
    className={cn(
      'flex items-stretch gap-6 overflow-x-auto border-b border-border',
      // Horizontal scroll on a phone beats wrapping into two rows; the
      // scrollbar itself is hidden because the row is short and obvious.
      '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      className
    )}
    {...props}
  />
);

const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={cn(
      'relative -mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-0 pb-3 pt-2',
      'font-serif text-label font-bold uppercase tracking-label',
      'opacity-55 transition-[opacity,border-color] duration-200 ease-out',
      'hover:opacity-100',
      'data-[state=active]:border-primary data-[state=active]:opacity-100',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:pointer-events-none disabled:opacity-30',
      className
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }) => (
  <TabsPrimitive.Content
    className={cn(
      'pt-6 outline-none',
      'data-[state=active]:animate-[tpl-fade-in_var(--dur-3)_var(--ease-out)]',
      className
    )}
    {...props}
  />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
