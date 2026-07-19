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
}

export function StudentHeaderMenu({ fullName, initials }: StudentHeaderMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer"
          style={{ backgroundColor: 'var(--synapse-brown-100)', color: 'var(--accent-brand)' }}
          aria-label="Menu compte"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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
