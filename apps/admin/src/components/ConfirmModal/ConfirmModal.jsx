import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

/**
 * Confirmation before something irreversible.
 *
 * Now built on Radix AlertDialog rather than a plain portal. AlertDialog
 * is the right primitive for this specifically because it is *not*
 * dismissible by clicking the backdrop — the old version closed on any
 * outside click, which for a delete prompt means the answer to a
 * destructive question could be given by a stray click. Escape and Cancel
 * still dismiss it.
 *
 * It also focuses Cancel rather than Confirm on open, so pressing Return
 * out of habit does not delete anything, and announces itself as an alert
 * dialog with its title and message wired up as the accessible name and
 * description.
 *
 * The call signature is unchanged, so every existing screen keeps working.
 */
const ConfirmModal = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  loading = false,
}) => (
  <AlertDialogPrimitive.Root
    open
    onOpenChange={(next) => {
      if (!next && !loading) onCancel?.();
    }}
  >
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="modal-overlay" />
      <AlertDialogPrimitive.Content className="modal-content confirm-modal">
        <AlertDialogPrimitive.Title asChild>
          <h2>{title}</h2>
        </AlertDialogPrimitive.Title>

        <AlertDialogPrimitive.Description className="confirm-message">
          {message}
        </AlertDialogPrimitive.Description>

        <div className="confirm-actions">
          {/* Cancel first and quiet; the committing action sits last and
              is the one that carries the emphasis. */}
          <AlertDialogPrimitive.Cancel asChild>
            <button type="button" className="btn-outline btn-cancel" disabled={loading}>
              {cancelLabel}
            </button>
          </AlertDialogPrimitive.Cancel>

          <AlertDialogPrimitive.Action asChild>
            <button
              type="button"
              className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
              onClick={(event) => {
                // The caller decides when to close: an action that needs to
                // report a failure has to be able to keep the dialog open,
                // so the default auto-close is prevented here.
                event.preventDefault();
                onConfirm?.();
              }}
              disabled={loading}
              aria-busy={loading || undefined}
            >
              {loading ? `${confirmLabel}…` : confirmLabel}
            </button>
          </AlertDialogPrimitive.Action>
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  </AlertDialogPrimitive.Root>
);

export default ConfirmModal;
