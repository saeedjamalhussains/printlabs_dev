import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { transitions } from '@printlabs/ui';
import { consumeAuthenticatedEntry } from '../../utils/entryTransition';
import './EntryCurtain.css';

/**
 * The one cinematic moment in the storefront: the reveal that plays when
 * somebody has just come through sign-in or sign-up onto the home page.
 *
 * It is a reveal, not a splash. The home page is already rendered and
 * already interactive underneath — the curtain is two panels of the
 * page's own paper ground drawing back off it, and it never intercepts a
 * click, so the delay it adds to actually using the product is zero.
 *
 * Only clip-path and opacity are animated, both of which the compositor
 * can handle without re-laying out the page beneath.
 */
const EntryCurtain = () => {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // The marker is consumed on the first navigation after authentication
    // whatever the destination, so it cannot sit around and fire later.
    // It only *plays* when that destination is the home page, which is
    // the entrance this animation is about — someone sent back to the
    // checkout they were interrupted at gets no curtain, because for them
    // this is a return to a task rather than an arrival.
    const justAuthenticated = consumeAuthenticatedEntry();
    // This is the subscribe-to-an-external-system case the rule exists to
    // make rare: the flag lives outside React, is written by the auth
    // flow, and is cleared as it is read — so this can fire at most once
    // per page load and cannot cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (justAuthenticated && pathname === '/') setPlaying(true);
  }, [pathname]);

  // Reduced motion: the entrance carries no information the page does not
  // already show, so it is skipped outright rather than played quickly.
  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          key="entry-curtain"
          className="entry-curtain"
          aria-hidden="true"
          onAnimationComplete={() => setPlaying(false)}
        >
          {/* Two panels parting from the centre line. Each is the page
              background, so nothing flashes a colour the product does not
              already use — it reads as the ground sliding off the page
              rather than as a screen being removed. */}
          <motion.span
            className="entry-curtain-panel entry-curtain-panel-top"
            initial={{ transform: 'translateY(0%)' }}
            animate={{ transform: 'translateY(-100%)' }}
            transition={transitions.curtain}
          />
          <motion.span
            className="entry-curtain-panel entry-curtain-panel-bottom"
            initial={{ transform: 'translateY(0%)' }}
            animate={{ transform: 'translateY(100%)' }}
            transition={transitions.curtain}
          />

          {/* A hairline drawn along the parting line, which fades as the
              panels clear. It gives the split an edge to travel from, so
              the movement reads as deliberate rather than as two blocks
              happening to leave at once. */}
          <motion.span
            className="entry-curtain-seam"
            initial={{ opacity: 1, scaleX: 1 }}
            animate={{ opacity: 0, scaleX: 0 }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EntryCurtain;
