'use client'

import Link from 'next/link'
import { ClockCounterClockwise, SignOut } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOutAction } from '@/data/auth/sign-out'

interface StudentHeaderMenuProps {
  fullName: string | null
  initials: string
  avatarUrl?: string | null
}

export function StudentHeaderMenu({ fullName, initials, avatarUrl }: StudentHeaderMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* 44px hit area, 32px avatar — touch target without a bigger visual. */}
        <button
          type="button"
          className="w-11 h-11 -mx-1.5 flex items-center justify-center cursor-pointer"
          aria-label="Menu compte"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName ?? 'Avatar'}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ backgroundColor: 'var(--synapse-brown-100)', color: 'var(--accent-brand)' }}
            >
              {initials}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{fullName ?? 'Mon compte'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/student/history" className="flex items-center gap-2 cursor-pointer">
            <ClockCounterClockwise size={16} />
            Historique
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full flex items-center gap-2 cursor-pointer" style={{ color: 'var(--destructive)' }}>
              <SignOut size={16} />
              Se déconnecter
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
