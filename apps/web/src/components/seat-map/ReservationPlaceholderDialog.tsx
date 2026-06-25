'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock } from '@phosphor-icons/react'
import type { Seat } from '@/data/admin/seat-map'

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReservationPlaceholderDialog({ seat, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <Clock className="h-6 w-6 text-orange-600" />
          </div>
          <DialogTitle>Réserver la place {seat?.label}</DialogTitle>
          <DialogDescription>
            La réservation en ligne sera disponible prochainement. Adressez-vous à un employé.
          </DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
          Fermer
        </Button>
      </DialogContent>
    </Dialog>
  )
}
