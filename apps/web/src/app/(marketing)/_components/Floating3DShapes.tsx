'use client';

import { motion, useReducedMotion } from 'motion/react';

type ShapeKind = 'sphere' | 'cube' | 'ring';

type Shape = {
  top: string;
  left: string;
  size: number;
  kind: ShapeKind;
  hue: 'orange' | 'brown';
  duration: number;
  delay: number;
  opacity?: number;
};

// One set per section so no two sections repeat the same arrangement.
const VARIANTS: Record<string, Shape[]> = {
  experience: [
    { top: '2%', left: '-10%', size: 220, kind: 'ring', hue: 'brown', duration: 26, delay: 0.4, opacity: 0.28 },
    { top: '58%', left: '86%', size: 190, kind: 'sphere', hue: 'orange', duration: 22, delay: 0.8, opacity: 0.3 },
    { top: '78%', left: '4%', size: 150, kind: 'cube', hue: 'orange', duration: 24, delay: 0.2, opacity: 0.26 },
    { top: '8%', left: '82%', size: 130, kind: 'cube', hue: 'brown', duration: 20, delay: 1.1, opacity: 0.24 },
  ],
  stats: [
    { top: '15%', left: '90%', size: 90, kind: 'cube', hue: 'orange', duration: 21, delay: 0.2 },
  ],
  etapes: [
    { top: '8%', left: '-5%', size: 130, kind: 'sphere', hue: 'brown', duration: 25, delay: 0 },
    { top: '75%', left: '90%', size: 100, kind: 'ring', hue: 'orange', duration: 23, delay: 1.2 },
  ],
};

const HUES = {
  orange: { a: '#F59542', b: '#E97920' },
  brown: { a: '#B68E67', b: '#8B6544' },
};

/** Large, softly 3D-shaded shapes that drift and tumble slowly behind a section's content. */
export function Floating3DShapes({ section }: { section: keyof typeof VARIANTS }) {
  const reduce = useReducedMotion();
  const shapes = VARIANTS[section] ?? [];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
      {shapes.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, perspective: 800 }}
          animate={
            reduce
              ? undefined
              : {
                  y: [0, -28, 0],
                  x: [0, 14, 0],
                }
          }
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShapeGlyph kind={s.kind} hue={s.hue} size={s.size} reduce={!!reduce} duration={s.duration} />
        </motion.div>
      ))}
    </div>
  );
}

function ShapeGlyph({
  kind,
  hue,
  size,
  reduce,
  duration,
}: {
  kind: ShapeKind;
  hue: 'orange' | 'brown';
  size: number;
  reduce: boolean;
  duration: number;
}) {
  const { a, b } = HUES[hue];

  if (kind === 'sphere') {
    return (
      <motion.div
        className="rounded-full opacity-[0.16]"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 32% 28%, ${a}, ${b} 70%)`,
          boxShadow: `inset -${size * 0.12}px -${size * 0.12}px ${size * 0.25}px rgba(0,0,0,0.25), 0 ${size * 0.15}px ${size * 0.3}px -${size * 0.1}px rgba(80,47,28,0.25)`,
        }}
        animate={reduce ? undefined : { rotate: [0, 20, 0] }}
        transition={{ duration: duration * 1.3, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  if (kind === 'ring') {
    const thickness = size * 0.22;
    return (
      <motion.div
        className="rounded-full opacity-[0.16]"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(from 210deg, ${a}, ${b}, ${a})`,
          maskImage: `radial-gradient(circle, transparent ${(size - thickness) / 2}px, black ${(size - thickness) / 2 + 1}px)`,
          WebkitMaskImage: `radial-gradient(circle, transparent ${(size - thickness) / 2}px, black ${(size - thickness) / 2 + 1}px)`,
          boxShadow: `0 ${size * 0.15}px ${size * 0.3}px -${size * 0.1}px rgba(80,47,28,0.2)`,
        }}
        animate={reduce ? undefined : { rotate: [0, 360] }}
        transition={{ duration: duration * 1.6, repeat: Infinity, ease: 'linear' }}
      />
    );
  }

  // cube — isometric CSS trick: three parallelogram/rhombus faces, shaded differently for depth.
  const half = size / 2;
  return (
    <motion.div
      className="opacity-[0.15]"
      style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
      animate={reduce ? undefined : { rotateX: [12, -8, 12], rotateY: [0, 360] }}
      transition={{ duration: duration * 1.8, repeat: Infinity, ease: 'linear' }}
    >
      <div
        style={{
          position: 'absolute',
          width: size * 0.86,
          height: size * 0.86,
          left: half - (size * 0.86) / 2,
          top: half - (size * 0.86) / 2,
          background: `linear-gradient(135deg, ${a}, ${b})`,
          transform: 'translateZ(40px)',
          borderRadius: 12,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: size * 0.86,
          height: size * 0.86,
          left: half - (size * 0.86) / 2,
          top: half - (size * 0.86) / 2,
          background: b,
          transform: 'rotateY(90deg) translateZ(40px)',
          borderRadius: 12,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: size * 0.86,
          height: size * 0.86,
          left: half - (size * 0.86) / 2,
          top: half - (size * 0.86) / 2,
          background: a,
          transform: 'rotateX(90deg) translateZ(40px)',
          borderRadius: 12,
        }}
      />
    </motion.div>
  );
}
