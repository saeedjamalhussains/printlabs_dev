import { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Label } from './label';

/**
 * One form row: label, control, and either a hint or an error beneath it.
 *
 * This exists because validation messaging was previously done a
 * different way on each screen — sometimes a banner at the top of the
 * form, sometimes nothing. Here the message always sits directly under
 * the field it belongs to, is wired up with aria-describedby, and is
 * announced via role="alert" when it appears.
 *
 * Children may be a single element (it receives id/aria wiring
 * automatically) or a render function for controls that need the ids.
 */
const Field = ({ label, hint, error, required, className, children, id: idProp, ...props }) => {
  const autoId = useId();
  const id = idProp ?? autoId;
  const msgId = `${id}-msg`;
  const described = error || hint ? msgId : undefined;

  const control =
    typeof children === 'function'
      ? children({ id, 'aria-describedby': described, 'aria-invalid': !!error || undefined })
      : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}

      {control}

      {/* Reserved by content, not by a fixed height: an error appearing
          should not be able to shift the submit button out from under a
          cursor mid-click, so errors render in flow and the form is
          spaced to absorb one line. */}
      {error ? (
        <p
          id={msgId}
          role="alert"
          className="flex items-start gap-1.5 font-sans text-meta text-destructive"
        >
          {/* An icon as well as the colour — red alone is not a signal. */}
          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={msgId} className="font-sans text-meta text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export { Field };
