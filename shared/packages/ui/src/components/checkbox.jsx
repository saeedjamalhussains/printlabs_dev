import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

/* A square that fills with ink when checked. 18px box inside a 44px
   touch target where it is used in a row (see the label pairing below). */
const Checkbox = ({ className, ...props }) => (
  <CheckboxPrimitive.Root
    className={cn(
      'peer inline-flex size-[18px] shrink-0 items-center justify-center',
      'border border-border-strong bg-transparent',
      'transition-colors duration-120 ease-out',
      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:cursor-not-allowed disabled:opacity-40',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="inline-flex items-center justify-center">
      {props.checked === 'indeterminate' ? (
        <Minus className="size-3" aria-hidden="true" />
      ) : (
        <Check className="size-3" aria-hidden="true" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export { Checkbox };
