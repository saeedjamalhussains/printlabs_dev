import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import './Dropdown.css';

/**
 * Theme-respecting replacement for the native <select> element.
 *
 * The menu is rendered through a portal into <body> so it can never
 * be clipped by an overflow:hidden / overflow:auto ancestor (e.g.
 * the .admin-table-wrapper). Position is computed from the trigger's
 * bounding rect on open and on every scroll/resize while open.
 */
const Dropdown = ({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null); // { top, left, width, openUp }
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const current = normalised.find((o) => o.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const maxMenuHeight = 240; // matches CSS
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Flip up if there's not enough room below AND more room above.
    const openUp = spaceBelow < maxMenuHeight && spaceAbove > spaceBelow;
    setCoords({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  };

  // Recompute position when opened, and on scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open]);

  // Click-outside / Escape close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (next) => {
    setOpen(false);
    if (next !== value) onChange?.(next);
  };

  return (
    <div className={`dropdown ${disabled ? 'dropdown--disabled' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`dropdown-trigger ${open ? 'dropdown-trigger--open' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="dropdown-value">{current?.label ?? value ?? ''}</span>
        <ChevronDown size={12} className="dropdown-chevron" />
      </button>

      {open && coords && createPortal(
        <ul
          ref={menuRef}
          className={`dropdown-menu ${coords.openUp ? 'dropdown-menu--up' : ''}`}
          role="listbox"
          style={{
            position: 'fixed',
            top: coords.openUp ? undefined : coords.top,
            bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
            left: coords.left,
            width: coords.width,
          }}
        >
          {normalised.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dropdown-option ${o.value === value ? 'dropdown-option--active' : ''}`}
              onClick={() => handlePick(o.value)}
            >
              {o.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default Dropdown;
