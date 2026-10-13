import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

/* A dialog that arrives from an edge. Used for the things that do not fit
   a centred panel on a phone — navigation, filters, a cart — where the
   previous approach was to shrink a desktop layout until it fitted. */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
  [
    'fixed z-50 flex flex-col gap-0 overflow-y-auto bg-background',
    'border-border-strong',
  ],
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full w-[min(24rem,85vw)] border-l data-[state=open]:animate-[tpl-slide-r-in_var(--dur-4)_var(--ease-out-soft)] data-[state=closed]:animate-[tpl-slide-r-out_var(--dur-3)_var(--ease-out)]',
        left:
          'inset-y-0 left-0 h-full w-[min(22rem,85vw)] border-r data-[state=open]:animate-[tpl-slide-l-in_var(--dur-4)_var(--ease-out-soft)] data-[state=closed]:animate-[tpl-slide-l-out_var(--dur-3)_var(--ease-out)]',
        bottom:
          'inset-x-0 bottom-0 max-h-[85dvh] w-full border-t data-[state=open]:animate-[tpl-slide-b-in_var(--dur-4)_var(--ease-out-soft)] data-[state=closed]:animate-[tpl-slide-b-out_var(--dur-3)_var(--ease-out)]',
      },
    },
    defaultVariants: { side: 'right' },
  }
);

const SheetContent = ({ className, children, side = 'right', showClose = true, ...props }) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-[var(--modal-overlay,rgb(0_0_0/0.4))]',
        'data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out'
      )}
    />
    <DialogPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 inline-flex size-9 items-center justify-center',
            'opacity-60 transition-opacity duration-200 ease-out hover:opacity-100',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          )}
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

const SheetHeader = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col gap-1 border-b border-border p-5 pr-14', className)}
    {...props}
  />
);

const SheetTitle = ({ className, ...props }) => (
  <DialogPrimitive.Title
    className={cn('font-serif text-md font-bold uppercase tracking-heading', className)}
    {...props}
  />
);

const SheetDescription = ({ className, ...props }) => (
  <DialogPrimitive.Description
    className={cn('font-sans text-meta text-muted-foreground', className)}
    {...props}
  />
);

const SheetBody = ({ className, ...props }) => (
  <div className={cn('flex-1 overflow-y-auto p-5', className)} {...props} />
);

const SheetFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-3 border-t border-border p-5', className)} {...props} />
);

export {
  Sheet, SheetTrigger, SheetClose, SheetContent,
  SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
};
