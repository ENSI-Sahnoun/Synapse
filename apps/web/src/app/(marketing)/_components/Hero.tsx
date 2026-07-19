'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { EASE_OUT } from '../_lib/motion';
import { SeatMapHero } from './SeatMapHero';
import { SectionDivider } from './SectionDivider';

export function Hero() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduce ? 1 : 0]);
  const roomY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 50]);

  const rise = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, ease: EASE_OUT, delay },
        };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_50%_-10%,#3A2718_0%,#1E1812_45%,#140D07_100%)] text-white"
    >
      {/* Ambient drifting warm glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(40% 45% at 72% 32%, rgba(233,121,32,0.22), transparent 70%), radial-gradient(38% 42% at 20% 78%, rgba(162,114,74,0.28), transparent 72%)',
          animation: reduce ? undefined : 'hero-glow-drift 22s ease-in-out infinite',
        }}
      />
      {/* Faint dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(100% 80% at 50% 0%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(100% 80% at 50% 0%, #000 30%, transparent 85%)',
        }}
      />

      <style>{`
        @keyframes hero-glow-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-3%, 4%) scale(1.08); }
        }
      `}</style>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-32 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-32 lg:pt-40">
        {/* Left: message */}
        <motion.div className="max-w-xl" style={{ y: contentY, opacity: contentOpacity }}>
          <motion.div
            {...rise(0)}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/75 backdrop-blur-sm"
          >
            <span className="size-1.5 rounded-full bg-[var(--synapse-orange-500)]" />
            Espace d’étude &amp; coworking · Sfax
          </motion.div>

          <motion.h1
            {...rise(0.08)}
            className="text-balance text-[clamp(2.6rem,7vw,4.75rem)] font-normal leading-[0.98] tracking-[-0.03em]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            Votre place
            <br />
            vous attend.
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-white/70"
          >
            Synapse est l’espace où l’on vient pour avancer. Réservez votre siège,
            scannez à l’entrée, installez-vous — et laissez le calme faire le reste.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="#choix"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[var(--synapse-stone-900)] transition-[transform,background-color] duration-200 hover:bg-white/90 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              Choisir mon espace
              <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#experience"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-base font-medium text-white/85 transition-colors hover:bg-white/5"
            >
              Découvrir Synapse
            </Link>
          </motion.div>
        </motion.div>

        {/* Right: the live room */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE_OUT, delay: 0.2 }}
          style={{ y: roomY }}
        >
          <SeatMapHero />
        </motion.div>
      </div>

      <SectionDivider fill="var(--synapse-cream-100)" />
    </section>
  );
}
