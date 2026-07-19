'use client';

import { motion, useReducedMotion } from 'motion/react';

type Shape = {
  top: string;
  left: string;
  size: number;
  kind: 'dot' | 'ring' | 'square';
  color: string;
  duration: number;
  delay: number;
};

const SHAPES: Shape[] = [
  { top: '10%', left: '5%', size: 14, kind: 'dot', color: 'var(--synapse-orange-400)', duration: 5.5, delay: 0 },
  { top: '20%', left: '91%', size: 26, kind: 'ring', color: 'var(--synapse-brown-400)', duration: 7, delay: 0.4 },
  { top: '70%', left: '4%', size: 20, kind: 'square', color: 'var(--synapse-orange-300)', duration: 6.2, delay: 0.8 },
  { top: '82%', left: '88%', size: 12, kind: 'dot', color: 'var(--synapse-brown-500)', duration: 5, delay: 1.2 },
  { top: '42%', left: '96%', size: 18, kind: 'ring', color: 'var(--synapse-orange-500)', duration: 6.8, delay: 0.2 },
  { top: '55%', left: '2%', size: 10, kind: 'dot', color: 'var(--synapse-orange-500)', duration: 5.8, delay: 1.6 },
];

/** Small, crisp accents that bob gently for scroll delight — distinct from the blurred ambient orbs in Backdrop. */
export function FloatingShapes() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
      {SHAPES.map((s, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={
            reduce
              ? undefined
              : {
                  y: [0, -14, 0],
                  rotate: s.kind === 'square' ? [0, 12, 0] : undefined,
                  opacity: [0.45, 0.85, 0.45],
                }
          }
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShapeGlyph kind={s.kind} color={s.color} size={s.size} />
        </motion.span>
      ))}
    </div>
  );
}

function ShapeGlyph({ kind, color, size }: { kind: Shape['kind']; color: string; size: number }) {
  if (kind === 'dot') {
    return <span className="block rounded-full" style={{ width: size, height: size, background: color, opacity: 0.7 }} />;
  }
  if (kind === 'ring') {
    return <span className="block rounded-full" style={{ width: size, height: size, border: `2px solid ${color}`, opacity: 0.55 }} />;
  }
  return <span className="block rounded-[4px]" style={{ width: size, height: size, background: color, opacity: 0.45 }} />;
}
