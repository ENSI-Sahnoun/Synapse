import { Reveal } from './Reveal';
import { Backdrop } from './Backdrop';
import { Floating3DShapes } from './Floating3DShapes';

const STEPS = [
  {
    n: '01',
    title: 'Choisissez votre place',
    body: 'Ouvrez le plan de salle, repérez un siège libre et réservez-le. En quelques secondes, il est à vous.',
  },
  {
    n: '02',
    title: 'Scannez votre QR',
    body: 'À l’entrée, présentez votre QR. Le check-in est instantané — votre présence est enregistrée automatiquement.',
  },
  {
    n: '03',
    title: 'Installez-vous',
    body: 'Votre place vous attend. Concentrez-vous ; on garde le reste (points, historique, abonnement) à jour pour vous.',
  },
];

export function HowItWorks() {
  return (
    <section id="etapes" className="relative scroll-mt-24 overflow-hidden bg-[var(--synapse-cream-100)] py-24 sm:py-32">
      <Backdrop variant="a" />
      <Floating3DShapes section="etapes" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mb-16 max-w-2xl">
          <h2
            className="text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.02] tracking-[-0.02em] text-[var(--synapse-stone-900)]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            Trois pas, et vous êtes assis.
          </h2>
          <p className="mt-4 max-w-md text-pretty text-lg text-[var(--synapse-stone-600)]">
            De la réservation à la concentration, sans détour.
          </p>
        </Reveal>

        <div className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {/* connecting line */}
          <div aria-hidden className="absolute left-0 right-0 top-7 hidden h-px bg-[var(--synapse-cream-300)] md:block" />

          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.14} className="relative">
              <div className="relative z-10 mb-6 flex size-14 items-center justify-center rounded-2xl bg-[var(--synapse-stone-900)] text-lg font-semibold text-white shadow-[0_16px_32px_-16px_rgba(30,24,18,0.7)]" style={{ fontFamily: 'var(--font-display)' }}>
                {s.n}
              </div>
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--synapse-stone-900)]" style={{ fontFamily: 'var(--font-display)' }}>
                {s.title}
              </h3>
              <p className="mt-2 max-w-xs text-pretty leading-relaxed text-[var(--synapse-stone-600)]">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
