import { cn } from '../lib/utils';

/* Underline, not a box. The storefront's inputs have always been a
   transparent field over a single bottom rule, and that is a large part
   of how the product reads — so shadcn's boxed input is deliberately not
   adopted here. What is adopted: one consistent height, a real focus
   treatment, and an invalid state that thickens the rule as well as
   colouring it, so the error is not carried by colour alone. */
const Input = ({ className, type = 'text', invalid = false, ...props }) => (
  <input
    type={type}
    aria-invalid={invalid || undefined}
    className={cn(
      'w-full min-w-0 bg-transparent px-0 py-3 font-sans text-base text-foreground',
      'border-0 border-b border-input outline-none',
      'transition-[border-color,box-shadow] duration-200 ease-out',
      'placeholder:text-muted-foreground placeholder:opacity-60',
      'hover:border-b-border-strong',
      'focus:border-b-primary focus:shadow-[0_1px_0_0_var(--color-primary)] focus-visible:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'aria-invalid:border-b-destructive aria-invalid:shadow-[0_1px_0_0_var(--color-destructive)]',
      'file:mr-3 file:border-0 file:bg-transparent file:font-serif file:text-label file:uppercase file:tracking-label',
      className
    )}
    {...props}
  />
);

const Textarea = ({ className, invalid = false, ...props }) => (
  <textarea
    aria-invalid={invalid || undefined}
    className={cn(
      'w-full min-h-24 resize-y bg-transparent px-0 py-3 font-sans text-base text-foreground',
      'border-0 border-b border-input outline-none',
      'transition-[border-color,box-shadow] duration-200 ease-out',
      'placeholder:text-muted-foreground placeholder:opacity-60',
      'hover:border-b-border-strong',
      'focus:border-b-primary focus:shadow-[0_1px_0_0_var(--color-primary)] focus-visible:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'aria-invalid:border-b-destructive aria-invalid:shadow-[0_1px_0_0_var(--color-destructive)]',
      className
    )}
    {...props}
  />
);

export { Input, Textarea };
