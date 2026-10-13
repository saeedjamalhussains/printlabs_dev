import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import PosterImage from '../PosterImage/PosterImage';
import { transitions } from '@printlabs/ui';
import './PosterCarousel.css';

/**
 * A horizontally browsable rail of posters.
 *
 * The scrolling itself is native overflow with CSS scroll-snap rather
 * than a JavaScript-transformed track. That is a deliberate choice over
 * reimplementing drag physics: native scrolling already gives real
 * momentum and rubber-banding on touch, it is interruptible mid-flight,
 * it works with a trackpad, shift-wheel, keyboard and screen-reader
 * navigation, and it cannot jam and strand the rail half-way. Motion is
 * layered on top of it for the parts it genuinely improves — the entrance
 * of the posters, and the feel of the arrow controls — rather than used
 * to rebuild scrolling from scratch.
 *
 * Pointer-drag is added for mouse users, who have no other way to pull
 * the rail sideways.
 */
const PosterCarousel = ({ posters = [], loading = false, skeletonCount = 5 }) => {
  const railRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const [edges, setEdges] = useState({ start: true, end: false });

  /* Which arrows make sense right now. Also drives the fade masks at the
     rail edges, so there is always a visible hint that more exists. */
  const measureEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const { scrollLeft, scrollWidth, clientWidth } = rail;
    setEdges({
      start: scrollLeft <= 2,
      end: scrollLeft + clientWidth >= scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measureEdges();
    rail.addEventListener('scroll', measureEdges, { passive: true });
    const observer = new ResizeObserver(measureEdges);
    observer.observe(rail);
    return () => {
      rail.removeEventListener('scroll', measureEdges);
      observer.disconnect();
    };
  }, [measureEdges, posters.length]);

  /* Scroll by roughly one viewport of the rail, less a card, so the
     poster at the edge stays visible and gives the eye an anchor. */
  const page = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector('.poster-rail-item');
    const step = card ? card.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8;
    const distance = Math.max(step, rail.clientWidth - step) * direction;
    rail.scrollBy({ left: distance, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  /* ── Mouse drag ───────────────────────────────────────────────────
     Touch already scrolls natively, so this is bound to mouse pointers
     only. It moves scrollLeft rather than transforming a track, which
     keeps it in the same coordinate space as every other way of
     scrolling — so a drag can be interrupted by a wheel or a keypress
     without the two fighting.

     A drag that travels more than a few pixels suppresses the click that
     follows, or releasing over a poster would navigate to it. */
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });

  const onPointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const rail = railRef.current;
    drag.current = { active: true, startX: event.clientX, startScroll: rail.scrollLeft, moved: 0 };
    rail.classList.add('is-dragging');
  };

  const onPointerMove = (event) => {
    if (!drag.current.active) return;
    const rail = railRef.current;
    const delta = event.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(delta));
    rail.scrollLeft = drag.current.startScroll - delta;
  };

  const endDrag = () => {
    const rail = railRef.current;
    if (!rail) return;
    drag.current.active = false;
    rail.classList.remove('is-dragging');
  };

  const onClickCapture = (event) => {
    if (drag.current.moved > 4) {
      event.preventDefault();
      event.stopPropagation();
    }
    drag.current.moved = 0;
  };

  if (!loading && posters.length === 0) return null;

  return (
    <div className="poster-rail-wrap">
      <div
        ref={railRef}
        className={`poster-rail ${edges.start ? 'at-start' : ''} ${edges.end ? 'at-end' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        /* A labelled, focusable scroll region: keyboard users can reach
           it and arrow through, and it is announced as a list of
           suggestions rather than as anonymous scrollable content. */
        tabIndex={0}
        role="region"
        aria-label="Suggested posters"
      >
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div className="poster-rail-item" key={`skeleton-${i}`} aria-hidden="true">
                {/* Same box the real poster will occupy, so nothing moves
                    when the images arrive. */}
                <div className="poster-rail-frame poster-rail-skeleton" />
                <div className="poster-rail-skeleton-line" />
              </div>
            ))
          : posters.map((poster, index) => (
              <motion.div
                className="poster-rail-item"
                key={poster._id}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { ...transitions.enter, delay: Math.min(index, 6) * 0.035 }
                }
              >
                <PosterRailCard poster={poster} />
              </motion.div>
            ))}
      </div>

      {/* Arrows are a desktop affordance — touch has the rail itself.
          Hidden from assistive tech only when they would do nothing. */}
      <div className="poster-rail-controls">
        <motion.button
          type="button"
          className="poster-rail-arrow"
          onClick={() => page(-1)}
          disabled={edges.start}
          aria-label="Previous suggestions"
          whileTap={reducedMotion ? undefined : { scale: 0.92 }}
          transition={transitions.nav}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </motion.button>
        <motion.button
          type="button"
          className="poster-rail-arrow"
          onClick={() => page(1)}
          disabled={edges.end}
          aria-label="More suggestions"
          whileTap={reducedMotion ? undefined : { scale: 0.92 }}
          transition={transitions.nav}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  );
};

/**
 * One poster in the rail. Holds its own image state so a single broken
 * URL degrades to a labelled placeholder instead of a torn icon, and
 * never changes the size of its box either way.
 */
const PosterRailCard = ({ poster }) => {
  const url = poster.images?.[0]?.url || poster.imageUrl || '';

  return (
    <Link to={`/product/${poster._id}`} className="poster-rail-card" draggable={false}>
      {/* The rail item is clamp(9.5rem, 22vw, 13rem) wide — 152px to
          208px — so it is capped well below the stored 800px and a phone
          here fetches the 160px rung. Everything in the rail is lazy:
          it sits below the product image, and posters past the right
          edge should not be fetched until they are scrolled toward. */}
      <PosterImage
        className="poster-rail-frame"
        url={url}
        variants={poster.images?.[0]?.variants}
        alt={poster.title}
        sizes="(max-width: 600px) 40vw, (max-width: 900px) 22vw, 208px"
        maxWidth={208}
      />

      <div className="poster-rail-meta">
        <span className="poster-rail-title">{poster.title}</span>
        <span className="poster-rail-price">₹{poster.price?.toLocaleString()}</span>
      </div>
    </Link>
  );
};

export default PosterCarousel;
