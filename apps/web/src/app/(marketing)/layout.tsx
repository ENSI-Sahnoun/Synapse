import type { Metadata } from 'next';
import { MarketingNav } from './_components/MarketingNav';
import { Footer } from './_components/Footer';
import { CursorGlow } from './_components/CursorGlow';

export const metadata: Metadata = {
  title: 'Synapse — Votre espace d’étude & coworking à Sfax',
  description:
    'Réservez votre place, scannez à l’entrée, installez-vous. Synapse est l’espace d’étude et de coworking de Sfax : sièges en direct, check-in QR, abonnements et fidélité.',
  openGraph: {
    title: 'Synapse — Votre espace d’étude & coworking à Sfax',
    description:
      'Réservez votre place, scannez à l’entrée, installez-vous. L’espace d’étude et de coworking de Sfax.',
    type: 'website',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-[var(--synapse-cream-100)] text-[var(--synapse-stone-900)] antialiased">
      <CursorGlow />
      <MarketingNav />
      <main className="relative">{children}</main>
      <Footer />
    </div>
  );
}
