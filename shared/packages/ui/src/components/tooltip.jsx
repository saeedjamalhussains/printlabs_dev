import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../lib/utils';

/* For naming icon-only controls. Note the rule that goes with it: a
   tooltip is an enhancement, never the only label — every icon button in
   the app also carries an aria-label or sr-only text, because a tooltip
   is unreachable by touch. */
const TooltipProvider = ({ delayDuration = 250, ...props }) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = ({ className, sideOffset = 6, ...props }) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        'z-50 border border-border-strong bg-background px-2 py-1',
        'font-sans text-micro font-semibold uppercase tracking-label text-foreground',
        'data-[state=delayed-open]:animate-pop-in data-[state=closed]:animate-pop-out',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
);

/** The common case in one element, so no screen hand-rolls the trio. */
const IconTooltip = ({ label, children, side = 'top' }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side}>{label}</TooltipContent>
  </Tooltip>
);

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, IconTooltip };
