'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../_lib/motion';

const COLS = 9;
const ROWS = 5;
const TOTAL = COLS * ROWS;

// Deterministic pseudo-random (SSR === client), same trick as the login QR field.
function rand(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// The resting truth: ~73% of seats taken, scattered but plausible. Rendered
// identically on the server so no-JS / reduced-motion see a full, alive room.
const OCCUPIED_PATTERN = Array.from({ length: TOTAL }, (_, i) => rand(i) > 0.27);
const TARGET_COUNT = OCCUPIED_PATTERN.filter(Boolean).length;

// Scattered reveal order — makes the room look like it fills up by check-ins
// rather than sweeping left-to-right.
const REVEAL_ORDER = Array.from({ length: TOTAL }, (_, i) => i).sort(
  (a, b) => rand(a + 7) - rand(b + 7),
);
const RANK = REVEAL_ORDER.reduce<number[]>((acc, seat, rank) => {
  acc[seat] = rank;
  return acc;
}, []);

const STEP = 0.032; // seconds between seat entrances
const REVEAL_MS = TOTAL * STEP * 1000;

export function SeatMapHero() {
  const reduce = useReducedMotion();
  const [occupied, setOccupied] = useState<boolean[]>(OCCUPIED_PATTERN);
  const [count, setCount] = useState(reduce ? TARGET_COUNT : 0);
  const rafRef = useRef<number | null>(null);

  // Count-up synced to the reveal cascade.
  useEffect(() => {
    if (reduce) {
      setCount(TARGET_COUNT);
      return;
    }
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / REVEAL_MS);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setCount(Math.round(eased * TARGET_COUNT));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduce]);

  // Ambient life: a check-in or check-out every few seconds, held in a tight band.
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setOccupied((prev) => {
        const taken = prev.filter(Boolean).length;
        const wantFree = taken >= TARGET_COUNT + 2;
        const wantFill = taken <= TARGET_COUNT - 2;
        // Pick a seat matching the desired direction.
        const pool = prev
          .map((o, i) => ({ o, i }))
          .filter(({ o }) => (wantFree ? o : wantFill ? !o : true));
        const choice = pool[Math.floor(Math.random() * pool.length)];
        if (!choice) return prev;
        const next = [...prev];
        next[choice.i] = !next[choice.i];
        setCount(next.filter(Boolean).length);
        return next;
      });
    }, 2600);
    return () => window.clearInterval(id);
  }, [reduce]);

  const pct = Math.round((count / TOTAL) * 100);

  return (
    <div className="relative w-full">
      {/* Live occupancy chip */}
      <div className="absolute -top-3 right-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(30,24,18,0.75)] px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-lg backdrop-blur-md">
        <span className="relative flex size-2">
          {!reduce && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--synapse-orange-400)] opacity-60" />
          )}
          <span className="relative inline-flex size-2 rounded-full bg-[var(--synapse-orange-500)]" />
        </span>
        <span className="tabular-nums">
          {count}/{TOTAL} places · {pct}%
        </span>
      </div>

      <div
        className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(45,32,22,0.9),rgba(20,13,7,0.92))] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] sm:p-7"
        style={{ perspective: reduce ? undefined : '1400px' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <span
            className="text-sm font-semibold tracking-tight text-white/85"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Salle principale
          </span>
          <span className="text-[0.7rem] uppercase tracking-wider text-white/40">
            en direct
          </span>
        </div>

        {/* Floor, tilted for depth — tables of 3 seats, grouped with real spacing */}
        <div
          className="rounded-2xl bg-black/15 p-3 sm:p-4"
          style={{
            transform: reduce ? undefined : 'rotateX(32deg) rotateZ(0deg) scale(1.02)',
            transformStyle: 'preserve-3d',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="grid gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4"
            style={{ gridTemplateColumns: `repeat(${COLS / 3}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: COLS / 3 }, (_, tableCol) =>
              Array.from({ length: ROWS }, (_, row) => {
                const base = row * COLS + tableCol * 3;
                return (
                  <Table key={`${tableCol}-${row}`}>
                    {[0, 1, 2].map((k) => (
                      <Seat key={k} occupied={occupied[base + k]} rank={RANK[base + k]} reduce={!!reduce} />
                    ))}
                  </Table>
                );
              }),
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-5 text-[0.7rem] text-white/45">
          <Legend swatch="bg-[var(--synapse-orange-500)]" label="Occupée" glow />
          <Legend swatch="bg-white/10" label="Libre" />
        </div>
      </div>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[0.6rem] bg-[linear-gradient(155deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-1.5"
      style={{ boxShadow: '0 6px 14px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-center gap-1.5">{children}</div>
    </div>
  );
}

function Seat({
  occupied,
  rank,
  reduce,
}: {
  occupied: boolean;
  rank: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: 1,
        translateZ: reduce ? 0 : occupied ? 7 : 0,
      }}
      transition={{
        opacity: { duration: 0.5, ease: EASE_OUT, delay: reduce ? 0 : rank * STEP },
        scale: { duration: 0.5, ease: EASE_OUT, delay: reduce ? 0 : rank * STEP },
        translateZ: { duration: 0.5, ease: EASE_OUT },
      }}
      className="relative flex aspect-square w-full max-w-8 flex-col items-center"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* backrest */}
      <span
        className="h-1 w-[70%] rounded-full transition-colors duration-500"
        style={{ background: occupied ? 'var(--synapse-orange-300)' : 'rgba(255,255,255,0.12)' }}
      />
      {/* seat body */}
      <span
        className="mt-[2px] flex h-full w-full items-center justify-center rounded-[0.35rem] transition-[background-color,box-shadow] duration-500"
        style={{
          background: occupied
            ? 'linear-gradient(150deg, var(--synapse-orange-400), var(--synapse-orange-600))'
            : 'rgba(255,255,255,0.045)',
          boxShadow: occupied
            ? '0 3px 10px rgba(0,0,0,0.35), 0 0 12px rgba(245,149,66,0.5), inset 0 1px 0 rgba(255,255,255,0.25)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <span
          className="size-1.5 rounded-full transition-colors duration-500"
          style={{ background: occupied ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)' }}
        />
      </span>
    </motion.div>
  );
}

function Legend({ swatch, label, glow }: { swatch: string; label: string; glow?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`size-3 rounded-[0.25rem] ${swatch}`}
        style={glow ? { boxShadow: '0 0 8px rgba(245,149,66,0.5)' } : undefined}
      />
      {label}
    </span>
  );
}
