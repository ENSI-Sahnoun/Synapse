'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { User } from 'lucide-react';
import { EASE_OUT } from '../_lib/motion';
import { createClient } from '@/supabase-clients/client';
import type { LandingSeatmapMode, PublicSeatRow } from '@/data/marketing/seatmap';

const MOCK_COLS = 9;
const MOCK_ROWS = 5;
const MOCK_TOTAL = MOCK_COLS * MOCK_ROWS;

// Deterministic pseudo-random (SSR === client), same trick as the login QR field.
function rand(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// The resting truth: ~73% of seats taken, scattered but plausible. Rendered
// identically on the server so no-JS / reduced-motion see a full, alive room.
const MOCK_OCCUPIED_PATTERN = Array.from({ length: MOCK_TOTAL }, (_, i) => rand(i) > 0.27);
const MOCK_TARGET_COUNT = MOCK_OCCUPIED_PATTERN.filter(Boolean).length;

// Scattered reveal/occupancy order — makes the room look like it fills up by
// check-ins rather than sweeping left-to-right. Reused for both modes.
function rankOrder(n: number) {
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => rand(a + 7) - rand(b + 7));
  return order.reduce<number[]>((acc, seat, rank) => {
    acc[seat] = rank;
    return acc;
  }, []);
}

const MOCK_RANK = rankOrder(MOCK_TOTAL);
const STEP = 0.032; // seconds between seat entrances
const MOCK_REVEAL_MS = MOCK_TOTAL * STEP * 1000;

// Pick a grid shape from a real total seat count — landscape-ish, capped so a
// big venue doesn't produce a wall of tiny icons.
function gridDims(total: number) {
  if (total <= 0) return { cols: 1, rows: 1 };
  const cols = Math.max(4, Math.min(12, Math.round(Math.sqrt(total * 1.8))));
  const rows = Math.max(1, Math.ceil(total / cols));
  return { cols, rows };
}

// Stable per-id hash (SSR === client, no Math.random) — used only to scatter
// display order so the grid doesn't look mechanically sorted by insertion.
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function SeatMapHero({
  mode,
  initialRows,
}: {
  mode: LandingSeatmapMode;
  initialRows: PublicSeatRow[] | null;
}) {
  return mode === 'real' ? <RealSeatMap initial={initialRows ?? []} /> : <MockSeatMap />;
}

/** Live venue occupancy, aggregated across every room. Updates over a Supabase Realtime socket. */
function RealSeatMap({ initial }: { initial: PublicSeatRow[] }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState(initial);

  // Re-sync when the server sends fresh rows (e.g. after navigation).
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const build = () =>
      supabase
        .channel('landing-seat-occupancy')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'seats' },
          (payload) => {
            setRows((prev) => {
              if (payload.eventType === 'INSERT') {
                const row = payload.new as PublicSeatRow;
                if (prev.some((r) => r.id === row.id)) return prev;
                return [...prev, row];
              }
              if (payload.eventType === 'UPDATE') {
                const row = payload.new as PublicSeatRow;
                return prev.map((r) => (r.id === row.id ? row : r));
              }
              const old = payload.old as PublicSeatRow;
              return prev.filter((r) => r.id !== old.id);
            });
          },
        )
        .subscribe();

    // Auth must be on the socket before the first join, or the subscription
    // is treated as fully anonymous and RLS silently drops every event.
    void supabase.realtime
      .setAuth()
      .catch(() => {})
      .then(() => {
        if (disposed) return;
        channel = build();
      });

    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const visible = rows.filter((r) => r.status !== 'out_of_service');
  const ordered = [...visible].sort((a, b) => hashId(a.id) - hashId(b.id));
  const total = ordered.length;
  const occupied = ordered.filter((r) => r.status === 'occupied').length;
  const { cols, rows: gridRows } = gridDims(total);
  const cellCount = cols * gridRows;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="relative w-full">
      <OccupancyChip count={occupied} total={total} pct={pct} reduce={!!reduce} />
      <RoomFrame reduce={!!reduce}>
        <div
          className="grid gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cellCount }, (_, i) => {
            const seat = ordered[i];
            if (!seat) return <div key={i} aria-hidden />;
            return <Seat key={seat.id} occupied={seat.status === 'occupied'} rank={i} reduce={!!reduce} />;
          })}
        </div>
      </RoomFrame>
    </div>
  );
}

/** Decorative simulation — a fixed 45-seat room with ambient check-ins. */
function MockSeatMap() {
  const reduce = useReducedMotion();
  const [occupied, setOccupied] = useState<boolean[]>(MOCK_OCCUPIED_PATTERN);
  const [count, setCount] = useState(reduce ? MOCK_TARGET_COUNT : 0);
  const rafRef = useRef<number | null>(null);

  // Count-up synced to the reveal cascade.
  useEffect(() => {
    if (reduce) {
      setCount(MOCK_TARGET_COUNT);
      return;
    }
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / MOCK_REVEAL_MS);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setCount(Math.round(eased * MOCK_TARGET_COUNT));
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
        const wantFree = taken >= MOCK_TARGET_COUNT + 2;
        const wantFill = taken <= MOCK_TARGET_COUNT - 2;
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

  const pct = Math.round((count / MOCK_TOTAL) * 100);

  return (
    <div className="relative w-full">
      <OccupancyChip count={count} total={MOCK_TOTAL} pct={pct} reduce={!!reduce} />
      <RoomFrame reduce={!!reduce}>
        <div
          className="grid gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4"
          style={{ gridTemplateColumns: `repeat(${MOCK_COLS / 3}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: MOCK_COLS / 3 }, (_, tableCol) =>
            Array.from({ length: MOCK_ROWS }, (_, row) => {
              const base = row * MOCK_COLS + tableCol * 3;
              return (
                <Table key={`${tableCol}-${row}`}>
                  {[0, 1, 2].map((k) => (
                    <Seat key={k} occupied={occupied[base + k]} rank={MOCK_RANK[base + k]} reduce={!!reduce} />
                  ))}
                </Table>
              );
            }),
          )}
        </div>
      </RoomFrame>
    </div>
  );
}

function OccupancyChip({
  count,
  total,
  pct,
  reduce,
}: {
  count: number;
  total: number;
  pct: number;
  reduce: boolean;
}) {
  return (
    <div className="absolute -top-3 right-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(30,24,18,0.75)] px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-lg backdrop-blur-md">
      <span className="relative flex size-2">
        {!reduce && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--synapse-orange-400)] opacity-60" />
        )}
        <span className="relative inline-flex size-2 rounded-full bg-[var(--synapse-orange-500)]" />
      </span>
      <span className="tabular-nums">
        {count}/{total} places · {pct}%
      </span>
    </div>
  );
}

function RoomFrame({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  return (
    <div
      className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(45,32,22,0.9),rgba(20,13,7,0.92))] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] sm:p-7"
      style={{ perspective: reduce ? undefined : '1400px' }}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-white/85" style={{ fontFamily: 'var(--font-display)' }}>
          Salle principale
        </span>
        <span className="text-[0.7rem] uppercase tracking-wider text-white/40">en direct</span>
      </div>

      <div
        className="rounded-2xl bg-black/15 p-3 sm:p-4"
        style={{
          transform: reduce ? undefined : 'rotateX(32deg) rotateZ(0deg) scale(1.02)',
          transformStyle: 'preserve-3d',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.35)',
        }}
      >
        {children}
      </div>

      <div className="mt-5 flex items-center gap-5 text-[0.7rem] text-white/45">
        <Legend swatch="bg-[var(--synapse-orange-500)]" label="Occupée" glow />
        <Legend swatch="bg-white/10" label="Libre" />
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

/** A single seat, rendered as a person — filled and lit when occupied, faint outline when free. */
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
      className="relative flex aspect-square w-full max-w-8 items-center justify-center"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <span
        className="flex size-full items-center justify-center rounded-[0.45rem] transition-[background-color,box-shadow] duration-500"
        style={{
          background: occupied
            ? 'linear-gradient(150deg, var(--synapse-orange-400), var(--synapse-orange-600))'
            : 'rgba(255,255,255,0.045)',
          boxShadow: occupied
            ? '0 3px 10px rgba(0,0,0,0.35), 0 0 12px rgba(245,149,66,0.5), inset 0 1px 0 rgba(255,255,255,0.25)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <User
          className="size-[62%] transition-colors duration-500"
          strokeWidth={occupied ? 2.25 : 1.75}
          style={{ color: occupied ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.22)' }}
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
