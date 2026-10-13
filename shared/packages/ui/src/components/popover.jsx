import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

const PopoverContent = ({ className, align = 'start', sideOffset = 6, ...props }) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 border border-border-strong bg-popover p-4 shadow-[var(--box-shadow)]',
        'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
);

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose };
