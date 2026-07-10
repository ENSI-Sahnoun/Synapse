'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartBar, Users, UserCircle, CreditCard, Buildings, Armchair, ShoppingCart, QrCode, Gear, Star, Gift, ClipboardText, CalendarBlank, Megaphone, Export, Wallet } from '@phosphor-icons/react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

const ICON_MAP: Record<string, PhosphorIcon> = {
  ChartBar,
  Users,
  UserCircle,
  CreditCard,
  Buildings,
  Armchair,
  ShoppingCart,
  QrCode,
  Gear,
  Star,
  Gift,
  ClipboardText,
  CalendarBlank,
  Megaphone,
  Export,
  Wallet,
}

interface SidebarNavLinkProps {
  href: string
  label: string
  icon: string
}

export function SidebarNavLink({ href, label, icon }: SidebarNavLinkProps) {
  const Icon = ICON_MAP[icon] ?? ChartBar
  const [hovered, setHovered] = useState(false)
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 cursor-pointer border-l-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-foreground)',
        backgroundColor: active ? 'var(--sidebar-active-bg)' : hovered ? 'var(--sidebar-accent)' : 'transparent',
        borderLeftColor: active ? 'var(--sidebar-active-border)' : 'transparent',
      }}
    >
      <Icon size={20} weight={active ? 'bold' : 'regular'} />
      {label}
    </Link>
  )
}
