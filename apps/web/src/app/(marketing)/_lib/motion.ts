/**
 * Shared motion vocabulary for the marketing surface.
 *
 * Easing curves follow Emil Kowalski's design-engineering guidance: the built-in
 * CSS easings are too weak, so we use stronger custom cubic-beziers. Entering /
 * exiting elements use ease-out (instant, responsive); on-screen movement uses
 * ease-in-out. Springs are used for decorative pointer-tracking where momentum
 * makes the motion feel alive.
 */

// Strong ease-out for entrances and feedback.
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Strong ease-in-out for elements that move/morph on screen.
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
// iOS-like drawer curve (from Ionic).
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

// Apple-style spring: reason in duration + bounce, not stiffness/damping.
export const SPRING_SOFT = { type: 'spring', duration: 0.6, bounce: 0.18 } as const;
export const SPRING_TILT = { type: 'spring', stiffness: 150, damping: 18, mass: 0.6 } as const;
export const SPRING_MAGNET = { type: 'spring', stiffness: 200, damping: 22, mass: 0.5 } as const;

/**
 * Reveal-on-view variants. The default (visible) state is the resting style;
 * motion drives the entrance. Keep translate small — big travel reads as busy.
 */
export const revealUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT, delay: i * 0.06 },
  }),
};

export const revealScale = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.65, ease: EASE_OUT, delay: i * 0.07 },
  }),
};

// Standard once-only in-view config: fire a little before the element is centered.
export const IN_VIEW = { once: true, margin: '-80px' } as const;
