import { type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)' }}
    >
      <header className="p-4">
        <Link href="/" className="inline-flex items-center" aria-label="Synapse — accueil">
          <Image
            src="/logos/synapse-logo-nobg.png"
            alt="Synapse"
            width={44}
            height={44}
            priority
          />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}
