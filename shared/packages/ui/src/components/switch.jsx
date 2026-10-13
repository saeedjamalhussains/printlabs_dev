import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../lib/utils';

/* The one place a pill radius is correct — a track is a track. Symmetric
   easing, because it moves both ways. */
const Switch = ({ className, ...props }) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-pill',
      'border border-border-strong p-0.5',
      'transition-colors duration-200 ease-in-out',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-transparent',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:cursor-not-allowed disabled:opacity-40',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-3.5 rounded-pill',
        'transition-transform duration-200 ease-in-out',
        'data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground',
        'data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-primary'
      )}
    />
  </SwitchPrimitive.Root>
);

export { Switch };
