import { cva } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* Status labels. The storefront keeps these monochrome; the admin's
   order/user states are the project's documented chromatic exception and
   pass their own colours in via className, so state is never carried by
   colour alone — the word is always present. */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 border px-2 py-0.5',
    'font-sans text-micro font-semibold uppercase tracking-label whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        default: 'border-border-strong bg-transparent text-foreground',
        solid: 'border-primary bg-primary text-primary-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        destructive: 'border-destructive bg-transparent text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Badge = ({ className, variant, ...props }) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge, badgeVariants };
