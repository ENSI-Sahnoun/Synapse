'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

/**
 * Ambient graphic layer for the cream sections — soft color orbs + a faint dot
 * grid that drift with scroll, so the space behind the content cards isn't
 * flat white. Purely decorative: absolute, inset-0, z-0, pointer-events-none.
 */
export function Backdrop({ variant = 'a' }: { variant?: 'a' | 'b' }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const slow = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : -40, reduce ? 0 : 40]);
  const fast = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 60, reduce ? 0 : -60]);

  const orbs =
    variant === 'a'
      ? [
          { top: '-8%', left: '-6%', size: 420, color: 'rgba(233,121,32,0.14)', y: slow },
          { top: '55%', left: '82%', size: 340, color: 'rgba(162,114,74,0.16)', y: fast },
        ]
      : [
          { top: '4%', left: '78%', size: 380, color: 'rgba(245,149,66,0.12)', y: fast },
          { top: '62%', left: '-8%', size: 460, color: 'rgba(137,89,58,0.14)', y: slow },
        ];

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* faint dot grid, fading toward the edges */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: 'radial-gradient(rgba(78,58,39,0.09) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(85% 70% at 50% 40%, #000 40%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(85% 70% at 50% 40%, #000 40%, transparent 90%)',
        }}
      />
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            top: o.top,
            left: o.left,
            width: o.size,
            height: o.size,
            background: o.color,
            y: o.y,
          }}
        />
      ))}
    </div>
  );
}
