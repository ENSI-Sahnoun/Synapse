import Link from 'next/link';
import { ArrowRight, Mail, Phone, MapPin, Clock, MessageCircle } from 'lucide-react';
import { Wordmark } from './Wordmark';
import { SITE, waLink, telLink, mailLink } from '../_lib/site';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[var(--synapse-stone-900)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: 'radial-gradient(50% 60% at 80% 0%, rgba(233,121,32,0.14), transparent 70%)' }}
      />

      {/* Final CTA */}
      <div className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8 sm:pt-24">
        <div className="flex flex-col items-start justify-between gap-8 border-b border-white/10 pb-16 md:flex-row md:items-end">
          <h2
            className="max-w-xl text-balance text-[clamp(2rem,4.5vw,3rem)] font-normal leading-[1.05] tracking-[-0.02em]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            Prêt à trouver votre place ?
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[var(--synapse-stone-900)] transition-[transform,background-color] duration-200 hover:bg-white/90 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              Je suis étudiant
              <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Je suis professionnel
            </Link>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark tone="inverse" />
          <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-white/55">
            L’espace d’étude et de coworking de {SITE.city}. Réservez, scannez,
            installez-vous.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            Nous trouver
          </h3>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--synapse-orange-400)]" />
              <span>{SITE.address}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-[var(--synapse-orange-400)]" />
              <span>{SITE.hours}</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            Nous joindre
          </h3>
          <ul className="space-y-3 text-sm text-white/70">
            <li>
              <a href={mailLink()} className="inline-flex items-center gap-2.5 transition-colors hover:text-white">
                <Mail className="size-4 shrink-0 text-[var(--synapse-orange-400)]" />
                {SITE.email}
              </a>
            </li>
            <li>
              <a href={telLink()} className="inline-flex items-center gap-2.5 transition-colors hover:text-white">
                <Phone className="size-4 shrink-0 text-[var(--synapse-orange-400)]" />
                {SITE.phone}
              </a>
            </li>
            <li>
              <a href={waLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 transition-colors hover:text-white">
                <MessageCircle className="size-4 shrink-0 text-[var(--synapse-orange-400)]" />
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-white/40 sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} Synapse · {SITE.city}</span>
          <div className="flex items-center gap-5">
            <Link href="/login" className="transition-colors hover:text-white/70">Se connecter</Link>
            <Link href="/contact" className="transition-colors hover:text-white/70">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
