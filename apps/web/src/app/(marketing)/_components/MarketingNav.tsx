'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Wordmark } from './Wordmark';

const SECTION_LINKS = [
  { href: '/#experience', label: "L'espace" },
  { href: '/#etapes', label: 'Comment ça marche' },
  { href: '/contact', label: 'Professionnels' },
];

/**
 * Sticky top nav. Transparent over the dark hero, then frosts into a translucent
 * material once the user scrolls past it — the one deliberate glass surface on
 * the page. Section anchors only appear on the landing route.
 */
export function MarketingNav() {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Frost whenever scrolled, or always on inner (light) pages.
  const frosted = scrolled || !isLanding;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-500',
        frosted
          ? 'border-b border-black/5 bg-[rgba(250,247,240,0.72)] shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Synapse — accueil" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--synapse-brown-400)]">
          <Wordmark tone={frosted ? 'ink' : 'inverse'} />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {isLanding && (
            <div className="mr-2 hidden items-center gap-1 md:flex">
              {SECTION_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                    frosted
                      ? 'text-[var(--synapse-stone-600)] hover:text-[var(--synapse-stone-900)]'
                      : 'text-white/70 hover:text-white',
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/login"
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-[transform,background-color,color] duration-200 active:scale-[0.97] motion-reduce:active:scale-100',
              frosted
                ? 'bg-[var(--synapse-stone-900)] text-white hover:bg-[var(--synapse-stone-800)]'
                : 'bg-white text-[var(--synapse-stone-900)] hover:bg-white/90',
            )}
          >
            Se connecter
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
