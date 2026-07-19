'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Synapse wordmark: a small neural "synapse" glyph (two nodes firing across a
 * gap) beside the name. The spark travels the connection on a slow loop — a
 * quiet nod to the brand name. Motion is suppressed under reduced-motion.
 */
export function Wordmark({
  className,
  tone = 'ink',
}: {
  className?: string;
  tone?: 'ink' | 'inverse';
}) {
  const reduce = useReducedMotion();
  const ink = tone === 'inverse' ? '#FFFFFF' : 'var(--synapse-stone-900)';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <line x1="6" y1="20" x2="20" y2="6" stroke="var(--synapse-brown-400)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <circle cx="6" cy="20" r="3.5" fill="var(--synapse-brown-500)" />
        <circle cx="20" cy="6" r="3.5" fill="var(--synapse-orange-500)" />
        {!reduce && (
          <motion.circle
            r="1.8"
            fill="#FFF"
            initial={{ cx: 6, cy: 20, opacity: 0 }}
            animate={{ cx: [6, 20], cy: [20, 6], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.4 }}
          />
        )}
      </svg>
      <span
        className="text-[1.35rem] font-bold tracking-[-0.02em]"
        style={{ fontFamily: 'var(--font-display)', color: ink }}
      >
        Synapse
      </span>
    </span>
  );
}
