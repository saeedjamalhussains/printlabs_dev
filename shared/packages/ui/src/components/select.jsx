import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

/* Native <select> could not be styled to match the app's own panels —
   which is why the dark-mode option list needed the color-scheme
   workarounds in index.css. This keeps the underline trigger the product
   uses, but the list is now a real panel on the paper ground, still fully
   keyboard-operable. */
const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = ({ className, children, invalid = false, ...props }) => (
  <SelectPrimitive.Trigger
    aria-invalid={invalid || undefined}
    className={cn(
      'flex min-h-11 w-full items-center justify-between gap-2 bg-transparent px-0 py-3',
      'border-0 border-b border-input font-sans text-base text-foreground',
      'transition-[border-color] duration-200 ease-out outline-none',
      'hover:border-b-border-strong',
      'focus:border-b-primary focus-visible:outline-none',
      'data-[state=open]:border-b-primary',
      'data-[placeholder]:text-muted-foreground data-[placeholder]:opacity-60',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'aria-invalid:border-b-destructive',
      '[&>span]:truncate [&>span]:text-left',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        className="size-3.5 shrink-0 opacity-60 transition-transform duration-200 ease-out"
        aria-hidden="true"
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);

const SelectContent = ({ className, children, position = 'popper', ...props }) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      position={position}
      sideOffset={4}
      className={cn(
        'relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
        'border border-border-strong bg-popover shadow-[var(--box-shadow)]',
        'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center">
        <ChevronUp className="size-3" aria-hidden="true" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center">
        <ChevronDown className="size-3" aria-hidden="true" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);

const SelectItem = ({ className, children, ...props }) => (
  <SelectPrimitive.Item
    className={cn(
      'relative flex cursor-pointer select-none items-center py-2 pl-8 pr-3',
      'font-sans text-label uppercase tracking-label text-foreground outline-none',
      'transition-colors duration-120 ease-out',
      'data-[highlighted]:bg-accent',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      className
    )}
    {...props}
  >
    <span className="absolute left-2.5 inline-flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);

const SelectLabel = ({ className, ...props }) => (
  <SelectPrimitive.Label
    className={cn('px-3 py-2 font-sans text-micro font-semibold uppercase tracking-label text-muted-foreground', className)}
    {...props}
  />
);

const SelectSeparator = ({ className, ...props }) => (
  <SelectPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
);

export {
  Select, SelectGroup, SelectValue, SelectTrigger,
  SelectContent, SelectItem, SelectLabel, SelectSeparator,
};
