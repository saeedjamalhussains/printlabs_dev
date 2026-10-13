import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/utils';

/* The product's button voice, unchanged: New York serif, 700, uppercase,
   0.2em tracking, square corners. What shadcn adds here is that every
   button in the app now comes from one place, so heights and paddings
   stop drifting between screens — and `loading` is built in, because an
   async action that gives no feedback was the most common gap. */
const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 text-center',
    'font-serif font-bold uppercase tracking-button',
    'transition-[color,background-color,border-color,opacity,transform] duration-200 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-40',
    'active:translate-y-px',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // Solid ink. The single primary action on a screen.
        default: 'bg-primary text-primary-foreground hover:opacity-85',
        // Hairline box. Secondary actions that still need a target.
        outline:
          'border border-border-strong bg-transparent text-foreground hover:bg-accent',
        // Underlined text. Tertiary, sits inside content.
        ghost: 'bg-transparent text-foreground opacity-70 hover:opacity-100 hover:bg-accent',
        link: 'bg-transparent text-foreground underline-offset-4 opacity-70 hover:opacity-100 hover:underline',
        // Destructive is the one place chromatic colour is allowed, and it
        // is paired with wording, never colour alone.
        destructive:
          'border border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground',
        subtle: 'bg-muted text-foreground hover:bg-accent',
      },
      // min-h rather than h, with real vertical padding. A fixed height
      // is a clipping bug waiting for someone to raise their browser or
      // OS text size: the box stays 44px, the label grows past it, and
      // the button silently truncates. These keep the same resting size
      // and grow instead of cutting the label off.
      size: {
        sm: 'min-h-9 px-4 py-1.5 text-micro [&_svg]:size-3.5',
        default: 'min-h-11 px-6 py-2 text-label [&_svg]:size-4',
        lg: 'min-h-14 px-10 py-3 text-sm [&_svg]:size-4',
        // Icon-only, so there is no text to outgrow the box. 44px square
        // is the comfortable touch target.
        icon: 'size-11 [&_svg]:size-4',
        'icon-sm': 'size-9 [&_svg]:size-3.5',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'default', size: 'default', block: false },
  }
);

const Button = ({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}) => {
  const Comp = asChild ? Slot : 'button';

  // A loading button stays the same width and keeps its label readable —
  // swapping the label for a bare spinner makes the row jump and loses
  // what is happening. aria-busy announces it without a visual-only cue.
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="animate-[tpl-spin_0.7s_linear_infinite]" aria-hidden="true" />}
      {loading && loadingLabel ? loadingLabel : children}
    </Comp>
  );
};

export { Button, buttonVariants };
