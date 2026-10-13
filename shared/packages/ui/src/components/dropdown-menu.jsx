import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

/* Keyboard-navigable menu with type-ahead and proper roles, replacing the
   click-outside div the admin used. Square panel, hairline border, no
   radius — the same box as every other surface. */
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const menuSurface = [
  'z-50 min-w-[10rem] overflow-hidden border border-border-strong bg-popover p-1',
  'shadow-[var(--box-shadow)]',
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
];

const itemBase = [
  'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2',
  'font-sans text-label uppercase tracking-label text-foreground outline-none',
  'transition-colors duration-120 ease-out',
  'data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  '[&_svg]:size-3.5 [&_svg]:shrink-0',
];

const DropdownMenuContent = ({ className, sideOffset = 4, align = 'start', ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      align={align}
      className={cn(menuSurface, className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);

const DropdownMenuItem = ({ className, destructive = false, ...props }) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      itemBase,
      // Destructive items are separated and coloured, and are expected to
      // open a confirmation rather than act immediately.
      destructive && 'text-destructive data-[highlighted]:bg-destructive/10',
      className
    )}
    {...props}
  />
);

const DropdownMenuCheckboxItem = ({ className, children, checked, ...props }) => (
  <DropdownMenuPrimitive.CheckboxItem
    checked={checked}
    className={cn(itemBase, 'pl-8', className)}
    {...props}
  >
    <span className="absolute left-2.5 inline-flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-3.5" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
);

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuRadioItem = ({ className, children, ...props }) => (
  <DropdownMenuPrimitive.RadioItem className={cn(itemBase, 'pl-8', className)} {...props}>
    <span className="absolute left-2.5 inline-flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-3.5" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
);

const DropdownMenuLabel = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Label
    className={cn(
      'px-3 py-2 font-sans text-micro font-semibold uppercase tracking-label text-muted-foreground',
      className
    )}
    {...props}
  />
);

const DropdownMenuSeparator = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
);

const DropdownMenuSubTrigger = ({ className, children, ...props }) => (
  <DropdownMenuPrimitive.SubTrigger className={cn(itemBase, 'justify-between', className)} {...props}>
    {children}
    <ChevronRight className="size-3.5" aria-hidden="true" />
  </DropdownMenuPrimitive.SubTrigger>
);

const DropdownMenuSubContent = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent className={cn(menuSurface, className)} {...props} />
  </DropdownMenuPrimitive.Portal>
);

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
};
