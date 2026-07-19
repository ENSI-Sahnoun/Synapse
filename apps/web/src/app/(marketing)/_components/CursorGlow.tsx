'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

/**
 * A soft warm glow that trails the cursor across the whole marketing surface —
 * the same brand halo used on the login panel, promoted to a page-wide ambient.
 * Spring-interpolated so it has momentum rather than snapping to the pointer.
 * Fixed, pointer-events-none, screen blend. Only revealed once a real (fine)
 * pointer moves, so it never shows on touch or under reduced-motion.
 */
export function CursorGlow() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 120, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 120, damping: 22, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setActive(true);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce, x, y]);

  if (reduce || !active) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: sx,
        top: sy,
        background:
          'radial-gradient(circle, rgba(245,149,66,0.10), rgba(162,114,74,0.05) 40%, transparent 68%)',
        mixBlendMode: 'plus-lighter',
      }}
    />
  );
}
