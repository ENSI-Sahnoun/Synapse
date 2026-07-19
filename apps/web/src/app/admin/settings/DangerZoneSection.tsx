'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { FinancialsResetCard } from './FinancialsResetCard'
import { AttendanceResetCard } from './AttendanceResetCard'
import { NotificationsResetCard } from './NotificationsResetCard'

const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

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
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: EASE_IN_OUT }}
          className="shrink-0"
        >
          <ChevronDown className="size-5" />
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: EASE_IN_OUT }}
        className="overflow-hidden"
      >
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
      </motion.div>
    </section>
  )
}
