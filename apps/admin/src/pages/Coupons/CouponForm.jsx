import { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';

const BLANK = {
  code: '',
  description: '',
  discountType: 'percent',
  value: '',
  maxDiscount: '',
  minOrderValue: '',
  startsAt: '',
  expiresAt: '',
  usageLimit: 0,
  perUserLimit: 1,
  firstOrderOnly: false,
  isActive: true,
};

/** ISO timestamp → the yyyy-mm-dd a date input expects. */
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/**
 * Create/edit form for a coupon.
 *
 * Editing did not exist before: fixing a typo in a code, or extending a
 * campaign by a week, meant deleting the coupon and building a new one —
 * which threw away its usage history.
 */
const CouponForm = ({ editing, onSubmit, onCancel, busy }) => {
  // Initial state is derived once. The parent gives this component a
  // `key` tied to the coupon being edited, so switching targets remounts
  // it rather than syncing props into state from an effect.
  const [form, setForm] = useState(() => {
    if (!editing) return BLANK;
    return {
      code: editing.code ?? '',
      description: editing.description ?? '',
      discountType: editing.discountType ?? 'percent',
      value: editing.value ?? '',
      maxDiscount: editing.maxDiscount ?? '',
      minOrderValue: editing.minOrderValue ?? '',
      startsAt: toDateInput(editing.startsAt),
      expiresAt: toDateInput(editing.expiresAt),
      usageLimit: editing.usageLimit ?? 0,
      perUserLimit: editing.perUserLimit ?? 1,
      firstOrderOnly: Boolean(editing.firstOrderOnly),
      isActive: editing.isActive !== false,
    };
  });

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      value: Number(form.value),
      // Empty means "no limit" — send null rather than 0, which the API
      // would read as a real ceiling of zero.
      maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
      minOrderValue: form.minOrderValue === '' ? 0 : Number(form.minOrderValue),
      usageLimit: Number(form.usageLimit),
      perUserLimit: Number(form.perUserLimit),
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
    });
  };

  const isPercent = form.discountType === 'percent';

  return (
    <form onSubmit={submit}>
      <div className="form-group">
        <label htmlFor="cf-code">Coupon Code</label>
        <input
          id="cf-code" name="code" type="text" value={form.code} onChange={change}
          placeholder="e.g. WELCOME10" required autoCapitalize="characters"
        />
      </div>

      <div className="form-group">
        <label htmlFor="cf-desc">Description</label>
        <input
          id="cf-desc" name="description" type="text" value={form.description}
          onChange={change} placeholder="What is this campaign for?" maxLength={140}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="cf-type">Discount Type</label>
          <select id="cf-type" name="discountType" value={form.discountType} onChange={change}>
            <option value="percent">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₹)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="cf-value">Value</label>
          <input
            id="cf-value" name="value" type="number" value={form.value} onChange={change}
            placeholder={isPercent ? 'e.g. 10' : 'e.g. 500'}
            min="0" max={isPercent ? 100 : undefined} required
          />
        </div>
      </div>

      <div className="form-row">
        {/* Only meaningful for percentages — a fixed amount is its own cap. */}
        <div className="form-group">
          <label htmlFor="cf-max">Max Discount (₹)</label>
          <input
            id="cf-max" name="maxDiscount" type="number" value={isPercent ? form.maxDiscount : ''}
            onChange={change} placeholder="No cap" min="0" disabled={!isPercent}
          />
          <span className="coupon-field-hint">
            {isPercent ? 'Caps a percentage discount' : 'Fixed amounts need no cap'}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="cf-min">Min Order (₹)</label>
          <input
            id="cf-min" name="minOrderValue" type="number" value={form.minOrderValue}
            onChange={change} placeholder="0" min="0"
          />
          <span className="coupon-field-hint">Subtotal required to apply</span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="cf-total">Total Uses</label>
          <input
            id="cf-total" name="usageLimit" type="number" value={form.usageLimit}
            onChange={change} min="0" required
          />
          <span className="coupon-field-hint">0 = unlimited</span>
        </div>

        <div className="form-group">
          <label htmlFor="cf-peruser">Per Customer</label>
          <input
            id="cf-peruser" name="perUserLimit" type="number" value={form.perUserLimit}
            onChange={change} min="0" required
          />
          <span className="coupon-field-hint">0 = unlimited</span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="cf-starts">Starts</label>
          <input id="cf-starts" name="startsAt" type="date" value={form.startsAt} onChange={change} />
          <span className="coupon-field-hint">Blank = immediately</span>
        </div>

        <div className="form-group">
          <label htmlFor="cf-expires">Expires</label>
          <input id="cf-expires" name="expiresAt" type="date" value={form.expiresAt} onChange={change} />
          <span className="coupon-field-hint">Blank = never</span>
        </div>
      </div>

      <div className="coupon-checks">
        <label className="coupon-check">
          <input type="checkbox" name="firstOrderOnly" checked={form.firstOrderOnly} onChange={change} />
          <span>First order only</span>
        </label>
        <label className="coupon-check">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} />
          <span>Active</span>
        </label>
      </div>

      <div className="coupon-form-actions">
        <button type="submit" className="admin-btn-primary" disabled={busy}>
          {editing ? <Save size={16} /> : <Plus size={16} />}
          <span>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}</span>
        </button>

        {editing && (
          <button type="button" className="coupon-cancel-btn" onClick={onCancel} disabled={busy}>
            <X size={14} /> <span>Cancel</span>
          </button>
        )}
      </div>
    </form>
  );
};

export default CouponForm;
