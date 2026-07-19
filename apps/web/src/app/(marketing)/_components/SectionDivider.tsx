'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../_lib/motion';

// Periodic (period 720, so 0 and 1440 land on the same y with the same
// tangent) — two copies placed edge-to-edge tile with no seam, letting the
// wave drift horizontally forever without a visible jump.
const WAVE_PATH =
  'M0,40 C120,10 240,10 360,40 C480,70 600,70 720,40 C840,10 960,10 1080,40 C1200,70 1320,70 1440,40 L1440,110 L0,110 Z';

/**
 * Shape divider between two sections — replaces flat gradient fades (which
 * read as a smear at the wrong edge) with a curve exactly at the seam, filled
 * with the color of the section it leads into. Rises into place with a
 * strong ease-out the first time it scrolls into view, then drifts sideways
 * on a slow seamless loop so it reads as a real wave instead of a static
 * shape. A flat safety strip under the curve guarantees no antialiasing
 * hairline can ever show the page background through the seam.
 */
export function SectionDivider({
  fill,
  className = '',
}: {
  fill: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[76px] w-full overflow-hidden sm:h-[118px] ${className}`}
    >
      {/* Defensive fill: covers the bottom edge so no sub-pixel seam can ever show through. */}
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: fill }} />

      <motion.svg
        viewBox="0 0 1440 110"
        preserveAspectRatio="none"
        className="relative h-full w-full"
        style={{ transformOrigin: 'bottom' }}
        initial={reduce ? false : { scaleY: 0.2, opacity: 0 }}
        animate={inView || reduce ? { scaleY: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      >
        <motion.g
          animate={reduce ? undefined : { x: [0, -1440] }}
          transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
        >
          <path d={WAVE_PATH} fill={fill} />
          <path d={WAVE_PATH} fill={fill} transform="translate(1440,0)" />
        </motion.g>
      </motion.svg>
    </div>
  );
}
