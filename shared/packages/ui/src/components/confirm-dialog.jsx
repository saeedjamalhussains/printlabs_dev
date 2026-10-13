import { Button } from './button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './dialog';

/**
 * One confirmation dialog for the whole app, replacing the per-page
 * variants. Two things it insists on:
 *
 *  - The title names the specific thing ("Delete 3 products?"), not
 *    "Are you sure?" — the consequence has to be legible at a glance.
 *  - Cancel comes first and is the quiet option; the destructive button is
 *    last and explicitly worded ("Delete product", not "OK"), so the
 *    button says what it will do.
 *
 * `loading` keeps the dialog open and the button busy while the request is
 * in flight, instead of closing optimistically and hoping.
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = true,
  loading = false,
  children,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md" showClose={!loading}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      {children}

      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          onClick={onConfirm}
          loading={loading}
          loadingLabel={`${confirmLabel}…`}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export { ConfirmDialog };
