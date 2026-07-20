'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { Reveal } from './Reveal';
import { Floating3DShapes } from './Floating3DShapes';

// TODO(placeholder): swap these for the real venue numbers before launch.
const STATS = [
  { value: 45, suffix: '', label: 'places de travail' },
  { value: 7, suffix: 'j/7', label: 'ouvert toute la semaine' },
  { value: 1200, suffix: '+', label: 'heures étudiées / mois' },
  { value: 98, suffix: '%', label: 'de membres qui reviennent' },
];

export function Stats() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(120%_140%_at_50%_0%,#3A2718,#1E1812_55%,#140D07)] py-20 text-white sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(40% 60% at 50% 0%, rgba(233,121,32,0.18), transparent 70%)' }}
      />
      <Floating3DShapes section="stats" />
      <div className="relative mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-12 px-5 sm:px-8 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="text-center">
            <div
              className="text-[clamp(2.5rem,6vw,4rem)] font-normal leading-none tracking-[-0.02em] text-white"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              <CountUp target={s.value} />
              <span className="text-[var(--synapse-orange-400)]">{s.suffix}</span>
            </div>
            <div className="mx-auto mt-3 max-w-[9rem] text-sm text-white/55">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CountUp({ target }: { target: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [go, setGo] = useState(false);
  const [n, setN] = useState(reduce ? target : 0);

  // Fail-open: run even if the observer never fires (headless / no observer).
  useEffect(() => {
    const t = window.setTimeout(() => setGo(true), 1000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (reduce || (!inView && !go)) return;
    let raf = 0;
    let start: number | null = null;
    const dur = 1400;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, go, reduce, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {n.toLocaleString('fr-FR')}
    </span>
  );
}
