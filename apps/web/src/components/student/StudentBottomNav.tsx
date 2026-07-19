'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { House, Storefront, Trophy, CreditCard, GearSix } from '@phosphor-icons/react'

const tabs = [
  { href: '/student/dashboard', label: 'Accueil', Icon: House },
  { href: '/student/shop', label: 'Boutique', Icon: Storefront },
  { href: '/student/rewards', label: 'Récompenses', Icon: Trophy },
  { href: '/student/rooms', label: 'Réserver', Icon: CreditCard },
  { href: '/student/settings', label: 'Paramètres', Icon: GearSix },
]

// Routes reachable from the shell that have no tab of their own. Without this
// the nav would highlight nothing and the app reads as "nowhere".
const routeAliases: Record<string, string> = {
  '/student/loyalty': '/student/rewards',
  '/student/qr': '/student/dashboard',
  '/student/history': '/student/dashboard',
}

const indicatorClassName = 'absolute top-0 inset-x-0 mx-auto w-8 h-[3px] rounded-b-full'

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function StudentBottomNav() {
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()

  const aliasedHref = Object.keys(routeAliases).find((from) => matches(pathname, from))
  const activeHref = aliasedHref
    ? routeAliases[aliasedHref]
    : tabs.find(({ href }) => matches(pathname, href))?.href

  function handlePress() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8)
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 flex border-t"
      style={{
        backgroundColor: 'var(--surface, #fff)',
        borderColor: 'var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: '64px',
      }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = href === activeHref
        return (
          <Link
            key={href}
            href={href}
            onClick={handlePress}
            aria-current={active ? 'page' : undefined}
            className="group relative flex-1 flex flex-col items-center justify-center py-3 gap-1 cursor-pointer transition-colors duration-150"
            style={{
              color: active ? 'var(--accent-brand)' : 'var(--muted-foreground)',
              minHeight: '44px',
            }}
          >
            {/* Only the active tab renders it, so the shared layoutId slides the
                bar across as the active tab changes. */}
            {active &&
              (reducedMotion ? (
                <span className={indicatorClassName} style={{ backgroundColor: 'var(--accent-brand)' }} />
              ) : (
                <motion.span
                  layoutId="student-nav-active"
                  className={indicatorClassName}
                  style={{ backgroundColor: 'var(--accent-brand)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              ))}
            <span className="transition-transform duration-150 group-active:scale-[0.92]">
              <Icon size={20} weight={active ? 'bold' : 'regular'} />
            </span>
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
