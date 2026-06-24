'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

interface SidebarNavLinkProps {
  href: string
  label: string
  Icon: PhosphorIcon
}

export function SidebarNavLink({ href, label, Icon }: SidebarNavLinkProps) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150 cursor-pointer border-l-2"
      style={{
        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-foreground)',
        backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
        borderLeftColor: active ? 'var(--sidebar-active-border)' : 'transparent',
      }}
    >
      <Icon size={18} weight={active ? 'bold' : 'regular'} />
      {label}
    </Link>
  )
}
