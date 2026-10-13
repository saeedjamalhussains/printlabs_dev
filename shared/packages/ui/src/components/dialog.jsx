import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

/* Replaces the hand-rolled portal modals, which had no focus trap, no
   Escape handling, no focus restore and no dialog role — a keyboard user
   could tab straight out of an open modal into the page behind it. Radix
   supplies all of that; the styling below keeps the plain square panel on
   the paper ground that the product already used. */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = ({ className, ...props }) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-[var(--modal-overlay,rgb(0_0_0/0.4))]',
      'data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out',
      className
    )}
    {...props}
  />
);

const DialogContent = ({ className, children, showClose = true, ...props }) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-y-auto',
        'border border-border-strong bg-background p-6',
        'shadow-[var(--box-shadow)]',
        'data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
        className
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 inline-flex size-8 items-center justify-center',
            'opacity-60 transition-opacity duration-200 ease-out hover:opacity-100',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          )}
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
);

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-2 pr-10 pb-4', className)} {...props} />
);

const DialogTitle = ({ className, ...props }) => (
  <DialogPrimitive.Title
    className={cn('font-serif text-lg font-bold uppercase tracking-heading', className)}
    {...props}
  />
);

const DialogDescription = ({ className, ...props }) => (
  <DialogPrimitive.Description
    className={cn('font-sans text-meta leading-relaxed text-muted-foreground', className)}
    {...props}
  />
);

/* Actions right-aligned, primary last — matching the order the app
   already used, so muscle memory survives. */
const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-3 pt-5 sm:flex-row sm:justify-end sm:items-center',
      className
    )}
    {...props}
  />
);

export {
  Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay,
  DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
};
