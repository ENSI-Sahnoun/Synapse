'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CreditCard, QrCode, MapPin, Star } from '@phosphor-icons/react'

const tabs = [
  { href: '/student/dashboard', label: 'Abonnement', Icon: CreditCard },
  { href: '/student/qr', label: 'QR Code', Icon: QrCode },
  { href: '/student/reservation', label: 'Réserver', Icon: MapPin },
  { href: '/student/loyalty', label: 'Points', Icon: Star },
]

export function StudentBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 flex border-t"
      style={{
        backgroundColor: 'var(--surface, #fff)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
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
              color: active ? 'var(--primary)' : 'var(--muted-foreground)',
              minHeight: '44px',
            }}
          >
            <Icon size={22} weight={active ? 'bold' : 'regular'} />
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
