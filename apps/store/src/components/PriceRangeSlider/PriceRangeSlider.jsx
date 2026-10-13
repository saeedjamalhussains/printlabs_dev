import { useCallback, useRef, useState } from 'react';
import './PriceRangeSlider.css';

/**
 * Dual-handle price range slider.
 *
 * Built as one track with two positioned thumbs, rather than two stacked
 * `<input type="range">` elements. That structure was the source of a
 * real bug: the two inputs covered each other completely, so whichever
 * sat underneath could not be grabbed once the handles met, and a range
 * collapsed at one end could never be reopened. Separate thumbs cannot
 * bury one another, and the one being dragged holds pointer capture for
 * the duration of the gesture.
 *
 * Native inputs gave keyboard support and ARIA for free, so both are
 * implemented explicitly here: each thumb is a `role="slider"` with the
 * usual arrow / Home / End / PageUp / PageDown bindings.
 *
 * `onCommit` fires when a gesture ends, so the URL is written once per
 * drag rather than on every pixel.
 */
const PriceRangeSlider = ({
  bounds,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onCommit,
  formatValue = (v) => `₹${v}`,
}) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'min' | 'max' | null

  const min = Number(bounds.min) || 0;
  const max = Number(bounds.max) || 0;
  const span = Math.max(1, max - min);

  // An empty string in the URL means "no bound", so fall back to the
  // catalogue edges and let the handles rest at the extremes.
  const currentMin = Math.min(Math.max(Number(minValue) || min, min), max);
  const currentMax = Math.min(Math.max(Number(maxValue) || max, min), max);

  const pct = (value) => ((value - min) / span) * 100;

  /** Pointer x → a value on the scale, clamped to the track. */
  const valueFromClientX = useCallback(
    (clientX) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return min;
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      return Math.round(min + ratio * span);
    },
    [min, span]
  );

  // The handles may not cross. Keeping a gap of 1 means the range is
  // always a range, never a single point that cannot be pulled apart.
  const commitValue = useCallback(
    (handle, raw) => {
      if (handle === 'min') {
        onMinChange(String(Math.min(Math.max(raw, min), currentMax - 1)));
      } else {
        onMaxChange(String(Math.max(Math.min(raw, max), currentMin + 1)));
      }
    },
    [min, max, currentMin, currentMax, onMinChange, onMaxChange]
  );

  const handlePointerDown = (handle) => (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(handle);
  };

  const handlePointerMove = (handle) => (event) => {
    if (dragging !== handle) return;
    commitValue(handle, valueFromClientX(event.clientX));
  };

  const endDrag = (event) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(null);
    onCommit?.();
  };

  /**
   * Clicking the track moves whichever handle is nearer, which is what
   * makes a wide track useful rather than decorative.
   */
  const handleTrackPointerDown = (event) => {
    if (dragging) return;
    const value = valueFromClientX(event.clientX);
    const handle =
      Math.abs(value - currentMin) <= Math.abs(value - currentMax) ? 'min' : 'max';
    commitValue(handle, value);
    onCommit?.();
  };

  const handleKeyDown = (handle) => (event) => {
    const current = handle === 'min' ? currentMin : currentMax;
    const step = Math.max(1, Math.round(span / 100));
    const bigStep = Math.max(step, Math.round(span / 10));

    const moves = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -bigStep,
      PageUp: bigStep,
    };

    if (event.key in moves) {
      event.preventDefault();
      commitValue(handle, current + moves[event.key]);
      onCommit?.();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      commitValue(handle, min);
      onCommit?.();
    }
    if (event.key === 'End') {
      event.preventDefault();
      commitValue(handle, max);
      onCommit?.();
    }
  };

  const thumbProps = (handle, value, label) => ({
    className: `price-slider-thumb${dragging === handle ? ' is-dragging' : ''}`,
    style: { left: `${pct(value)}%` },
    role: 'slider',
    tabIndex: 0,
    'aria-label': label,
    'aria-valuemin': handle === 'min' ? min : currentMin + 1,
    'aria-valuemax': handle === 'min' ? currentMax - 1 : max,
    'aria-valuenow': value,
    'aria-valuetext': formatValue(value),
    onPointerDown: handlePointerDown(handle),
    onPointerMove: handlePointerMove(handle),
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown: handleKeyDown(handle),
  });

  return (
    <div className="price-slider">
      <div className="price-slider-values">
        <span>{formatValue(currentMin)}</span>
        <span>{formatValue(currentMax)}</span>
      </div>

      <div
        className="price-slider-track-wrap"
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
      >
        <span className="price-slider-rail" />
        <span
          className="price-slider-fill"
          style={{ left: `${pct(currentMin)}%`, width: `${pct(currentMax) - pct(currentMin)}%` }}
        />

        <span {...thumbProps('min', currentMin, 'Minimum price')}>
          <span className="price-slider-bubble">{formatValue(currentMin)}</span>
        </span>
        <span {...thumbProps('max', currentMax, 'Maximum price')}>
          <span className="price-slider-bubble">{formatValue(currentMax)}</span>
        </span>
      </div>

      {/* The catalogue's full range, shown only once the selection is
          narrower than it — otherwise it just reprints the two figures
          already above the track. */}
      {(currentMin > min || currentMax < max) && (
        <div className="price-slider-bounds">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      )}
    </div>
  );
};

export default PriceRangeSlider;
