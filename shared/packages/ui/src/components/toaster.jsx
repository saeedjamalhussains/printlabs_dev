import { Toaster as Sonner, toast } from 'sonner';

/**
 * Toasts for the outcome of an async action — "saved", "couldn't save".
 * Retheming notes: Sonner ships rounded, shadowed, light-grey cards, so
 * every surface colour is re-pointed at the app's tokens and the radius is
 * removed. Errors get a longer life than successes, because a failure is
 * something to read rather than glance at.
 *
 * Placement is bottom-right. Callers can push it clear of anything already
 * anchored there by passing `offset` / `mobileOffset` — the storefront does
 * exactly that, because the Fabi launcher occupies that corner and an
 * unoffset toast lands on top of it.
 */
const Toaster = (props) => (
  <Sonner
    position="bottom-right"
    duration={4000}
    gap={8}
    // Screen readers get the message without the toast stealing focus.
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          'group flex w-full items-start gap-3 border border-border-strong bg-background p-4 font-sans shadow-[var(--box-shadow)]',
        title: 'text-label font-semibold uppercase tracking-label text-foreground',
        description: 'mt-1 text-meta leading-relaxed text-muted-foreground',
        actionButton:
          'ml-auto shrink-0 border border-border-strong px-2 py-1 font-serif text-micro font-bold uppercase tracking-label',
        cancelButton: 'ml-2 shrink-0 px-2 py-1 font-serif text-micro uppercase tracking-label opacity-60',
        closeButton: 'border border-border-strong bg-background',
        error: 'border-destructive text-destructive',
        icon: 'shrink-0',
      },
    }}
    {...props}
  />
);

export { Toaster, toast };
