import type { Metadata } from 'next';
import { Mail, Phone, MapPin, Clock, MessageCircle, Check } from 'lucide-react';
import { ContactForm } from './ContactForm';
import { SITE, waLink, telLink, mailLink } from '../_lib/site';

export const metadata: Metadata = {
  title: 'Contact professionnel — Synapse Sfax',
  description:
    'Freelance, indépendant ou équipe ? Parlons d’un accès dédié à Synapse : horaires étendus, poste réservé et un plan pensé pour votre rythme de travail.',
};

const PERKS = ['Horaires étendus', 'Poste dédié', 'Facturation entreprise', 'Accès prioritaire'];

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
      <div className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        {/* Pitch + direct contact */}
        <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_120%_at_20%_0%,#3A2718,#1E1812_55%,#140D07)] p-8 text-white sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: 'radial-gradient(45% 50% at 85% 10%, rgba(233,121,32,0.18), transparent 70%)' }}
          />
          <div className="relative">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--synapse-orange-400)]">
              Espace professionnel
            </span>
            <h1
              className="mt-3 text-balance text-[clamp(2.1rem,5vw,3.25rem)] font-normal leading-[1.02] tracking-[-0.02em]"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              Parlons de votre espace.
            </h1>
            <p className="mt-4 max-w-md text-pretty leading-relaxed text-white/70">
              Freelance, indépendant ou équipe en quête d’un lieu calme pour se concentrer ?
              Dites-nous ce qu’il vous faut — on construit l’accès qui vous ressemble.
            </p>

            <ul className="mt-7 grid grid-cols-2 gap-2.5">
              {PERKS.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="size-4 shrink-0 text-[var(--synapse-orange-400)]" />
                  {p}
                </li>
              ))}
            </ul>

            <div className="mt-9 space-y-4 border-t border-white/10 pt-8 text-sm">
              <a href={mailLink('Contact professionnel — Synapse')} className="flex items-center gap-3 text-white/80 transition-colors hover:text-white">
                <Mail className="size-4.5 shrink-0 text-[var(--synapse-orange-400)]" />
                {SITE.email}
              </a>
              <a href={telLink()} className="flex items-center gap-3 text-white/80 transition-colors hover:text-white">
                <Phone className="size-4.5 shrink-0 text-[var(--synapse-orange-400)]" />
                {SITE.phone}
              </a>
              <a href={waLink('Bonjour Synapse, je vous contacte au sujet d’un accès professionnel.')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/80 transition-colors hover:text-white">
                <MessageCircle className="size-4.5 shrink-0 text-[var(--synapse-orange-400)]" />
                Écrire sur WhatsApp
              </a>
              <div className="flex items-center gap-3 text-white/60">
                <MapPin className="size-4.5 shrink-0 text-[var(--synapse-orange-400)]" />
                {SITE.address}
              </div>
              <div className="flex items-center gap-3 text-white/60">
                <Clock className="size-4.5 shrink-0 text-[var(--synapse-orange-400)]" />
                {SITE.hours}
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div>
          <ContactForm />
          <p className="mt-4 px-2 text-center text-xs text-[var(--synapse-stone-400)]">
            En envoyant ce formulaire, vous acceptez d’être recontacté par l’équipe Synapse.
          </p>
        </div>
      </div>
    </section>
  );
}
