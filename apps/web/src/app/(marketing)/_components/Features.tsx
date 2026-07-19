'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CalendarCheck, QrCode, Sparkles, Activity } from 'lucide-react';
import { EASE_OUT } from '../_lib/motion';
import { Reveal } from './Reveal';
import { QrGlyph } from './QrGlyph';
import { Backdrop } from './Backdrop';

export function Features() {
  const items = [
    {
      icon: <CalendarCheck className="size-5" />,
      title: 'Réservez votre place',
      body: 'Choisissez votre siège sur le plan de salle en direct. Vous savez ce qui est libre avant même d’arriver — plus de tour de salle pour trouver une place.',
      motif: <SeatPickMotif />,
    },
    {
      icon: <QrCode className="size-5" />,
      title: 'Entrez d’un scan',
      body: 'Un QR signé à l’entrée fait le check-in en une seconde. Votre présence est enregistrée, votre place vous est réservée. Rien à remplir.',
      motif: <QrScanMotif />,
    },
    {
      icon: <Sparkles className="size-5" />,
      title: 'Abonnements & fidélité',
      body: 'Gérez votre abonnement, cumulez des points à chaque visite et débloquez des récompenses. Votre régularité est récompensée.',
      motif: <LoyaltyMotif />,
    },
    {
      icon: <Activity className="size-5" />,
      title: 'Suivez votre présence',
      body: 'Retrouvez votre historique de visites et le temps passé à Synapse. Un rythme visible, une progression qui se mesure.',
      motif: <PresenceMotif />,
    },
  ];

  return (
    <section id="experience" className="relative scroll-mt-24 overflow-hidden bg-[var(--synapse-cream-100)] py-24 sm:py-32">
      <Backdrop variant="b" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mb-16 max-w-2xl">
          <h2
            className="text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.02] tracking-[-0.02em] text-[var(--synapse-stone-900)]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            Pensé pour votre concentration.
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-lg text-[var(--synapse-stone-600)]">
            Tout ce qu’il faut pour venir, s’installer et avancer — sans friction.
          </p>
        </Reveal>

        <div className="flex flex-col gap-16 sm:gap-24">
          {items.map((it, i) => (
            <FeatureRow key={it.title} {...it} flip={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  icon,
  title,
  body,
  motif,
  flip,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  motif: React.ReactNode;
  flip: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <Reveal className={flip ? 'md:order-2' : ''}>
        <div className="max-w-md">
          <span className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-white text-[var(--synapse-brown-600)] shadow-[0_8px_24px_-12px_rgba(80,47,28,0.35)] ring-1 ring-[var(--synapse-cream-300)]">
            {icon}
          </span>
          <h3 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--synapse-stone-900)]" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h3>
          <p className="mt-3 text-pretty leading-relaxed text-[var(--synapse-stone-600)]">{body}</p>
        </div>
      </Reveal>

      <Reveal delay={0.08} className={flip ? 'md:order-1' : ''}>
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.75rem] border border-[var(--synapse-cream-300)] bg-[linear-gradient(150deg,#FFFFFF,var(--synapse-cream-100))] shadow-[0_24px_60px_-36px_rgba(80,47,28,0.4)]">
          {motif}
        </div>
      </Reveal>
    </div>
  );
}

/* ── Motifs ─────────────────────────────────────────────────── */

function SeatPickMotif() {
  const reduce = useReducedMotion();
  const cols = 6;
  const rows = 4;
  const chosen = 15; // the selected seat index
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols * rows }, (_, i) => {
        const isChosen = i === chosen;
        const taken = Math.sin(i * 91.7) * 0.5 + 0.5 > 0.6 && !isChosen;
        return (
          <motion.span
            key={i}
            className="relative size-7 rounded-lg sm:size-8"
            style={{
              background: isChosen
                ? 'var(--synapse-orange-500)'
                : taken
                  ? 'var(--synapse-cream-300)'
                  : '#FFFFFF',
              boxShadow: isChosen
                ? '0 0 0 3px rgba(245,149,66,0.25), 0 6px 16px -6px rgba(233,121,32,0.7)'
                : 'inset 0 0 0 1px var(--synapse-cream-300)',
            }}
            animate={reduce || !isChosen ? undefined : { scale: [1, 1.12, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        );
      })}
    </div>
  );
}

function QrScanMotif() {
  const reduce = useReducedMotion();
  return (
    <div className="relative size-32 overflow-hidden rounded-2xl bg-white p-3 shadow-inner ring-1 ring-[var(--synapse-cream-300)]">
      <QrGlyph value="https://synapse.tn/checkin" size={104} className="size-full" />
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-x-3 h-[3px] rounded-full"
          style={{ background: 'linear-gradient(90deg,transparent,var(--synapse-orange-500),transparent)', boxShadow: '0 0 12px var(--synapse-orange-500)' }}
          animate={{ top: ['12px', 'calc(100% - 12px)', '12px'] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

function LoyaltyMotif() {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: 5 }, (_, i) => (
        <motion.span
          key={i}
          className="flex size-9 items-center justify-center rounded-full text-white"
          style={{ background: i < 3 ? 'var(--synapse-brown-500)' : 'var(--synapse-cream-200)' }}
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.12 }}
        >
          {i < 3 && <Sparkles className="size-4" />}
        </motion.span>
      ))}
      <motion.span
        className="ml-1 rounded-full bg-[var(--synapse-green-500)] px-3 py-1 text-sm font-semibold text-white"
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.7 }}
      >
        +10
      </motion.span>
    </div>
  );
}

function PresenceMotif() {
  const reduce = useReducedMotion();
  const heights = [40, 65, 30, 80, 55, 95, 70];
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return (
    <div className="flex h-32 items-end gap-2.5">
      {heights.map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <motion.span
            className="w-5 rounded-t-md"
            style={{ background: i === 5 ? 'var(--synapse-orange-500)' : 'var(--synapse-brown-300)', height: reduce ? h : undefined }}
            initial={reduce ? false : { height: 6 }}
            animate={{ height: h }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: i * 0.06 }}
          />
          <span className="text-[0.65rem] font-medium text-[var(--synapse-stone-400)]">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}
