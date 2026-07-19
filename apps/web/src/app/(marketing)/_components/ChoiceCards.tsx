'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import { ArrowRight, Check, GraduationCap, Briefcase, Rocket } from 'lucide-react';
import { SPRING_TILT } from '../_lib/motion';
import { useReveal } from '../_lib/useReveal';
import { Reveal } from './Reveal';
import { Backdrop } from './Backdrop';
import { FloatingShapes } from './FloatingShapes';

const CURVE = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function ChoiceCards() {
  return (
    <section id="choix" className="relative overflow-hidden py-24 sm:py-32">
      {/* Warms the hard cut coming off the dark hero instead of dropping straight to near-white cream. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 sm:h-80"
        style={{ background: 'linear-gradient(to bottom, rgba(120,74,42,0.4), rgba(162,114,74,0.14) 55%, rgba(162,114,74,0))' }}
      />
      <Backdrop variant="a" />
      <FloatingShapes />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
      <Reveal className="mx-auto mb-14 max-w-2xl text-center">
        <h2
          className="text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.02] tracking-[-0.02em] text-[var(--synapse-stone-900)]"
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          Vous êtes… ?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-lg text-[var(--synapse-stone-600)]">
          Deux façons d’entrer à Synapse. Choisissez la vôtre.
        </p>
      </Reveal>

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <TiltCard
          href="/login"
          tone="warm"
          icon={<GraduationCap className="size-6" />}
          role="Étudiant"
          title="Entrez dans votre espace"
          desc="Réservez votre place, scannez votre QR à l’arrivée, suivez votre abonnement et vos points fidélité — le tout depuis votre téléphone."
          chips={['Réservation en direct', 'Check-in QR', 'Fidélité']}
          cta="Accéder à l’app"
          motif={<StudentMotif />}
          delay={0}
        />
        <TiltCard
          href="/contact"
          tone="deep"
          icon={<Briefcase className="size-6" />}
          role="Professionnel"
          title="Un espace à votre mesure"
          desc="Freelance, indépendant ou équipe ? Parlons d’un accès dédié, d’horaires étendus et d’un plan pensé pour votre rythme de travail."
          chips={['Plan sur mesure', 'Accès dédié', 'Facturation pro']}
          cta="Nous contacter"
          motif={<ProMotif />}
          delay={0.08}
        />
      </div>
      </div>
    </section>
  );
}

function TiltCard({
  href,
  tone,
  icon,
  role,
  title,
  desc,
  chips,
  cta,
  motif,
  delay,
}: {
  href: string;
  tone: 'warm' | 'deep';
  icon: React.ReactNode;
  role: string;
  title: string;
  desc: string;
  chips: string[];
  cta: string;
  motif: React.ReactNode;
  delay: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const { ref: revealRef, hidden } = useReveal<HTMLDivElement>();

  const rx = useSpring(0, SPRING_TILT);
  const ry = useSpring(0, SPRING_TILT);
  const gx = useMotionValue(50);
  const gy = useMotionValue(0);

  const transform = useMotionTemplate`perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  const sheen = useMotionTemplate`radial-gradient(360px circle at ${gx}% ${gy}px, ${
    tone === 'warm' ? 'rgba(255,255,255,0.28)' : 'rgba(245,149,66,0.22)'
  }, transparent 60%)`;

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (reduce) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 9);
    rx.set((0.5 - py) * 9);
    gx.set(px * 100);
    gy.set(e.clientY - r.top);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
    gx.set(50);
    gy.set(0);
  };

  const isWarm = tone === 'warm';

  return (
    <div
      ref={revealRef}
      style={{
        transformStyle: 'preserve-3d',
        ...(reduce
          ? {}
          : {
              opacity: hidden ? 0 : 1,
              transform: hidden ? 'translateY(28px)' : 'none',
              transition: `opacity 0.6s ${CURVE} ${delay}s, transform 0.7s ${CURVE} ${delay}s`,
              willChange: 'opacity, transform',
            }),
      }}
    >
      <Link
        ref={ref}
        href={href}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="group relative block h-full overflow-hidden rounded-[2rem] p-6 outline-none transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-[var(--synapse-orange-400)] focus-visible:ring-offset-2 sm:p-8"
        style={{ willChange: 'transform' }}
      >
        {/* tilt layer wraps the whole surface */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[2rem]"
          style={{
            transform: reduce ? undefined : transform,
            background: isWarm
              ? 'linear-gradient(155deg, #FFFFFF 0%, var(--synapse-cream-100) 55%, var(--synapse-cream-200) 100%)'
              : 'linear-gradient(155deg, #3A2A1E 0%, var(--synapse-stone-900) 55%, #140D07 100%)',
            boxShadow: isWarm
              ? '0 24px 60px -30px rgba(80,47,28,0.35), inset 0 1px 0 rgba(255,255,255,0.8)'
              : '0 30px 70px -30px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: isWarm ? '1px solid var(--synapse-cream-300)' : '1px solid rgba(255,255,255,0.08)',
          }}
        />
        {/* cursor sheen */}
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-[2rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: sheen }}
          />
        )}

        {/* content */}
        <div
          className={`relative flex h-full flex-col ${isWarm ? 'text-[var(--synapse-stone-900)]' : 'text-white'}`}
          style={{ transform: reduce ? undefined : 'translateZ(40px)' }}
        >
          <div className="mb-5 flex items-start justify-between">
            <span
              className={`inline-flex size-11 items-center justify-center rounded-2xl ${
                isWarm
                  ? 'bg-[var(--synapse-brown-500)] text-white'
                  : 'bg-[var(--synapse-orange-500)] text-[#2A1B0E]'
              }`}
            >
              {icon}
            </span>
            <div className="h-12 w-20 shrink-0">{motif}</div>
          </div>

          <span
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
              isWarm ? 'text-[var(--synapse-brown-600)]' : 'text-[var(--synapse-orange-400)]'
            }`}
          >
            {role}
          </span>
          <h3
            className="mt-1.5 text-[1.6rem] font-normal leading-tight tracking-[-0.01em]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            {title}
          </h3>
          <p className={`mt-2.5 max-w-sm text-pretty text-[0.95rem] leading-relaxed ${isWarm ? 'text-[var(--synapse-stone-600)]' : 'text-white/65'}`}>
            {desc}
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {chips.map((c) => (
              <li key={c} className="flex items-center gap-2.5 text-sm font-medium">
                <Check
                  className={`size-4 shrink-0 ${isWarm ? 'text-[var(--synapse-brown-500)]' : 'text-[var(--synapse-orange-400)]'}`}
                  strokeWidth={2.5}
                />
                <span className={isWarm ? 'text-[var(--synapse-stone-700)]' : 'text-white/80'}>{c}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-6">
            <span
              className={`inline-flex items-center gap-2 text-base font-semibold ${
                isWarm ? 'text-[var(--synapse-brown-700)]' : 'text-white'
              }`}
            >
              {cta}
              <ArrowRight className="size-4.5 transition-transform duration-300 group-hover:translate-x-1.5" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/** Student motif: a playful rocket badge with a soft breathing glow. */
function StudentMotif() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex h-full items-center justify-center rounded-xl bg-[var(--synapse-cream-200)] ring-1 ring-[var(--synapse-cream-300)]"
      animate={reduce ? undefined : { boxShadow: ['0 4px 16px -6px rgba(80,47,28,0.3)', '0 4px 20px -4px rgba(233,121,32,0.35)', '0 4px 16px -6px rgba(80,47,28,0.3)'] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        animate={reduce ? undefined : { rotate: [-6, 6, -6], y: [0, -3, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Rocket className="size-8 text-[var(--synapse-brown-600)]" />
      </motion.span>
    </motion.div>
  );
}

/** Pro motif: three "tailored" bars that grow to bespoke lengths. */
function ProMotif() {
  const reduce = useReducedMotion();
  const widths = ['85%', '55%', '70%'];
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {widths.map((w, i) => (
        <motion.span
          key={i}
          className="h-2 rounded-full bg-[var(--synapse-orange-500)]"
          style={{ width: reduce ? w : undefined }}
          animate={reduce ? undefined : { width: ['20%', w] }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: i * 0.12, repeat: Infinity, repeatType: 'reverse', repeatDelay: 2 }}
        />
      ))}
    </div>
  );
}
