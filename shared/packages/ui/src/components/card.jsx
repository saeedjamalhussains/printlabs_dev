import { cn } from '../lib/utils';

/* A hairline box on the paper ground. No shadow and no radius by default:
   in this design a card is separated by a rule and by whitespace, and
   adding elevation is what would make it look like a different product.
   `interactive` is opt-in, for cards that are really links. */
const Card = ({ className, interactive = false, ...props }) => (
  <div
    className={cn(
      'border border-border bg-card text-card-foreground',
      interactive &&
        'transition-[border-color,transform] duration-200 ease-out hover:border-border-strong focus-within:border-border-strong',
      className
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
);

const CardTitle = ({ className, as: As = 'h3', ...props }) => (
  <As
    className={cn('font-serif text-md font-bold uppercase tracking-heading', className)}
    {...props}
  />
);

const CardDescription = ({ className, ...props }) => (
  <p className={cn('font-sans text-meta text-muted-foreground', className)} {...props} />
);

const CardContent = ({ className, ...props }) => (
  <div className={cn('p-5 pt-0', className)} {...props} />
);

const CardFooter = ({ className, ...props }) => (
  <div className={cn('flex items-center gap-3 border-t border-border p-5', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
