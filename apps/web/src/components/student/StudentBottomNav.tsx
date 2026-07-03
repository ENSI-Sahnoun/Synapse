'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, ClockCounterClockwise, Star, CreditCard, GearSix } from '@phosphor-icons/react'

const tabs = [
  { href: '/student/dashboard', label: 'Accueil', Icon: House },
  { href: '/student/history', label: 'Historique', Icon: ClockCounterClockwise },
  { href: '/student/loyalty', label: 'Récompenses', Icon: Star },
  { href: '/student/rooms', label: 'Réserver', Icon: CreditCard },
  { href: '/student/settings', label: 'Paramètres', Icon: GearSix },
]

export function StudentBottomNav() {
  const pathname = usePathname()

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
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 cursor-pointer transition-colors duration-150"
            style={{
              color: active ? 'var(--accent-brand)' : 'var(--muted-foreground)',
              minHeight: '44px',
            }}
          >
            <Icon size={20} weight={active ? 'bold' : 'regular'} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
