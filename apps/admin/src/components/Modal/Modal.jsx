import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * The dashboard modal shell.
 *
 * Still called the same way — `{isOpen && <Modal onClose={…}>…</Modal>}` —
 * but the hand-rolled portal underneath has been replaced with Radix
 * Dialog, which fixes the behaviour this previously lacked:
 *
 *   - focus moves into the panel on open and returns to the trigger on
 *     close (before, focus stayed behind the overlay, so a keyboard user
 *     was tabbing through the page underneath an open modal)
 *   - Escape closes it
 *   - the dialog role and modal semantics are announced, and the rest of
 *     the page is hidden from assistive tech while it is open
 *   - scroll is locked to the panel rather than the page behind it
 *
 * The existing .modal-overlay / .modal-content styling is kept, so every
 * screen that opens a modal looks exactly as it did.
 *
 * `title` is optional only for backwards compatibility: a dialog needs an
 * accessible name, so when a caller does not pass one the panel's own
 * heading is expected to supply it and a visually hidden fallback keeps
 * the dialog from being announced as unnamed.
 */
const Modal = ({ children, onClose, title, description, className = '' }) => (
  <DialogPrimitive.Root
    open
    onOpenChange={(next) => {
      if (!next) onClose?.();
    }}
  >
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="modal-overlay" />
      <DialogPrimitive.Content className={`modal-content ${className}`.trim()}>
        {title ? (
          <DialogPrimitive.Title className="modal-title">{title}</DialogPrimitive.Title>
        ) : (
          <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
        )}

        {description && (
          <DialogPrimitive.Description className="modal-description">
            {description}
          </DialogPrimitive.Description>
        )}

        {children}

        <DialogPrimitive.Close className="modal-close" aria-label="Close dialog">
          <X size={16} aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export default Modal;
