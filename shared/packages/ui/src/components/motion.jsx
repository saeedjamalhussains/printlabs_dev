import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../lib/utils';

/* ─── Shared motion vocabulary ──────────────────────────────────────
   Three components cover nearly every case in the app. They exist so
   durations and distances are not re-invented per screen, and so the
   reduced-motion decision is made once, here, rather than remembered.

   The distances are small on purpose — 8px, 12px. Motion is being used to
   say "this is new" and to give the eye an order to read things in, not
   to perform. Anything that would still be moving after ~0.5s is too slow
   for an interface people use all day. */

const EASE = [0.16, 1, 0.3, 1]; // matches --ease-out

/** Fade-and-rise for a block arriving: a section, a card, a panel. */
const Reveal = ({ children, delay = 0, y = 8, className, as = 'div', ...props }) => {
  const reduced = useReducedMotion();
  const Comp = motion[as] ?? motion.div;

  return (
    <Comp
      initial={reduced ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.32, ease: EASE, delay: reduced ? 0 : delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Comp>
  );
};

/**
 * Parent for a list whose children should arrive in sequence. The stagger
 * is 35ms — enough to give the eye a direction, short enough that a
 * twenty-item grid is fully present in well under a second. Long lists cap
 * the cascade so the last row is never left waiting.
 */
const Stagger = ({ children, className, step = 0.035, as = 'div', ...props }) => {
  const reduced = useReducedMotion();
  const Comp = motion[as] ?? motion.div;

  return (
    <Comp
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: reduced ? 0 : step } },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Comp>
  );
};

/** Child of Stagger. */
const StaggerItem = ({ children, className, y = 12, as = 'div', ...props }) => {
  const reduced = useReducedMotion();
  const Comp = motion[as] ?? motion.div;

  return (
    <Comp
      variants={{
        hidden: reduced ? { opacity: 1 } : { opacity: 0, y },
        shown: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.32, ease: EASE } },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Comp>
  );
};

/* ─── Named transitions ─────────────────────────────────────────────
   One motion personality, three jobs. The shared traits are the easing
   family and the small travel distances; what changes is how long each
   one takes, which is set by what the motion is *for*.

   These are exported so the three signature interactions cannot drift
   apart into three different feels. */
const transitions = {
  /* Navigation state. Fast and functional — it says "you are here now",
     and anything slower sits between the click and the answer. Spring
     rather than a duration because the indicator travels a different
     distance between every pair of tabs, and a spring arrives in a
     consistent-feeling time regardless of how far it went. */
  nav: { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 },

  /* Content browsing. Physical: a little weight and a little overshoot,
     so dragging posters feels like moving objects rather than
     repositioning divs. */
  carousel: { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 },

  /* Entering the product. The one deliberately cinematic moment in the
     app, and still under three quarters of a second. */
  curtain: { duration: 0.72, ease: [0.76, 0, 0.24, 1] },

  /* The generic block entrance used by Reveal/Stagger. */
  enter: { duration: 0.32, ease: EASE },
};

export { Reveal, Stagger, StaggerItem, EASE, transitions };
