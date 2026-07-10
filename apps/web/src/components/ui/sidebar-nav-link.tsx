'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartBar } from '@phosphor-icons/react'
import { ICON_MAP } from '@/lib/nav-items'

interface SidebarNavLinkProps {
  href: string
  label: string
  icon: string
  count?: number
}

export function SidebarNavLink({ href, label, icon, count }: SidebarNavLinkProps) {
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
      <span style={{ flex: 1 }}>{label}</span>
      {!!count && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: '#dc2626',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
