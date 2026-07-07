'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FinancialsResetCard } from './FinancialsResetCard'
import { AttendanceResetCard } from './AttendanceResetCard'
import { NotificationsResetCard } from './NotificationsResetCard'

export function DangerZoneSection() {
  const [open, setOpen] = useState(false)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-destructive/50 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-semibold text-destructive">Zone de danger — purge de données</h2>
          <p className="text-sm text-muted-foreground">
            Suppression définitive et irréversible. Les comptes étudiants ne sont jamais touchés.
          </p>
        </div>
        {open ? <ChevronDown className="size-5 shrink-0" /> : <ChevronRight className="size-5 shrink-0" />}
      </button>

      {open && (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Masquer la zone de danger
          </Button>
          <FinancialsResetCard />
          <AttendanceResetCard />
          <NotificationsResetCard />
        </div>
      )}
    </section>
  )
}
