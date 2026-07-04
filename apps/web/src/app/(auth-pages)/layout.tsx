import { type ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)' }}
    >
      <header className="p-4">
        <Link
          href="/"
          className="text-lg tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--accent-brand)',
          }}
        >
          Synapse
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}
