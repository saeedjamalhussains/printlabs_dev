import { useState } from 'react';
import { X, PackagePlus } from 'lucide-react';
import Modal from '../../components/Modal/Modal';

/** Quick amounts, so the common case is one click rather than typing. */
const PRESETS = [10, 25, 50, 100];

const MAX_STOCK = 1_000_000;

/**
 * Adjust one product's stock level.
 *
 * Two modes, because both are real tasks and they are easy to confuse:
 * "add" is a delivery arriving, "set" is a stocktake correcting the books.
 * The resulting level is always shown before saving so the difference
 * between the two is never a guess.
 */
const RestockModal = ({ product, busy, onSave, onCancel }) => {
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');

  const current = Number(product.stock) || 0;
  const parsed = Number(amount);
  const valid = amount !== '' && Number.isInteger(parsed) && parsed >= 0;

  // Clamped so a typo cannot drive stock negative or absurdly high; the
  // server enforces the same bounds, this just avoids a pointless refusal.
  const nextStock = valid
    ? Math.min(MAX_STOCK, mode === 'add' ? current + parsed : parsed)
    : current;

  const unchanged = valid && nextStock === current;

  const submit = (e) => {
    e.preventDefault();
    if (!valid || unchanged) return;
    onSave(nextStock);
  };

  return (
    <Modal onClose={onCancel}>
      <div className="restock-head">
        <h2>
          <PackagePlus size={18} /> Restock
        </h2>
        <button type="button" className="restock-close" onClick={onCancel} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <p className="restock-product">{product.title}</p>

      <form onSubmit={submit}>
        <div className="restock-modes" role="group" aria-label="Restock mode">
          <button
            type="button"
            className={`restock-mode ${mode === 'add' ? 'is-selected' : ''}`}
            onClick={() => setMode('add')}
            aria-pressed={mode === 'add'}
          >
            Add stock
          </button>
          <button
            type="button"
            className={`restock-mode ${mode === 'set' ? 'is-selected' : ''}`}
            onClick={() => setMode('set')}
            aria-pressed={mode === 'set'}
          >
            Set exact
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="restock-amount">
            {mode === 'add' ? 'Units received' : 'Counted stock level'}
          </label>
          <input
            id="restock-amount"
            type="number"
            min="0"
            step="1"
            max={MAX_STOCK}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === 'add' ? 'e.g. 25' : String(current)}
            autoFocus
          />
        </div>

        {mode === 'add' && (
          <div className="restock-presets">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className="restock-preset"
                onClick={() => setAmount(String((Number(amount) || 0) + n))}
              >
                +{n}
              </button>
            ))}
            {amount !== '' && (
              <button type="button" className="restock-preset is-clear" onClick={() => setAmount('')}>
                Clear
              </button>
            )}
          </div>
        )}

        <div className="restock-summary">
          <span>Current</span>
          <strong>{current}</strong>
          <span aria-hidden="true">→</span>
          <span className="restock-summary-label">New</span>
          <strong className={nextStock > current ? 'is-up' : nextStock < current ? 'is-down' : ''}>
            {nextStock}
          </strong>
        </div>

        {current === 0 && nextStock > 0 && (
          <p className="restock-hint">
            This product is out of stock — shoppers cannot order it until this is saved.
          </p>
        )}
        {product.isActive === false && (
          <p className="restock-hint">
            Note: this product is discontinued, so it stays hidden from the storefront
            even once restocked. Reactivate it from the products table.
          </p>
        )}

        <div className="form-actions restock-form-actions">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !valid || unchanged}>
            {/* The count is only shown once it means something. Labelling
                an empty form "Save (10)" reads as though it would write
                the current value back. */}
            {busy ? 'Saving…' : !valid ? 'Save' : unchanged ? 'No change' : `Save (${nextStock})`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RestockModal;
