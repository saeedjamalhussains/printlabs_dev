import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';

/* Rule-separated rows that open with a height transition. The marker is a
   plus that rotates into a minus — a rotation reads as the same object
   changing state, where swapping two icons reads as a flicker. */
const Accordion = AccordionPrimitive.Root;

const AccordionItem = ({ className, ...props }) => (
  <AccordionPrimitive.Item className={cn('border-b border-border', className)} {...props} />
);

const AccordionTrigger = ({ className, children, ...props }) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      className={cn(
        'group flex flex-1 items-center justify-between gap-4 py-4 text-left',
        'font-serif text-label font-bold uppercase tracking-label',
        'transition-opacity duration-200 ease-out hover:opacity-70',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className
      )}
      {...props}
    >
      {children}
      <Plus
        className="size-3.5 shrink-0 transition-transform duration-320 ease-out group-data-[state=open]:rotate-45"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);

const AccordionContent = ({ className, children, ...props }) => (
  <AccordionPrimitive.Content
    className={cn(
      'overflow-hidden',
      'data-[state=open]:animate-[tpl-accordion-open_var(--dur-3)_var(--ease-out)]',
      'data-[state=closed]:animate-[tpl-accordion-close_var(--dur-2)_var(--ease-out)]'
    )}
    {...props}
  >
    <div className={cn('pb-4 font-sans text-base leading-relaxed opacity-80', className)}>
      {children}
    </div>
  </AccordionPrimitive.Content>
);

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
