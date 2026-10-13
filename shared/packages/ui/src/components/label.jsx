import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../lib/utils';

/* Uppercase micro-label above the field. `required` draws the marker
   itself so every form in the app indicates required fields the same
   way, and the asterisk is hidden from screen readers — the input's own
   `required` attribute is what announces it. */
const Label = ({ className, required = false, children, ...props }) => (
  <LabelPrimitive.Root
    className={cn(
      'flex items-center gap-1 font-sans text-micro font-semibold uppercase tracking-label',
      'text-muted-foreground select-none',
      'peer-disabled:opacity-40',
      className
    )}
    {...props}
  >
    {children}
    {required && (
      <>
        <span aria-hidden="true" className="text-destructive">*</span>
        <span className="sr-only">(required)</span>
      </>
    )}
  </LabelPrimitive.Root>
);

export { Label };
