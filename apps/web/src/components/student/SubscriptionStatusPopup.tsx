'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { WarningCircle, SmileySad } from '@phosphor-icons/react/dist/ssr'
import type { SubscriptionState } from '@/lib/subscription-status'

const SEEN_KEY_PREFIX = 'sub-status-popup-seen:'

export function SubscriptionStatusPopup({
  subscriptionId,
  state,
  endDateLabel,
}: {
  subscriptionId: string
  state: SubscriptionState
  endDateLabel: string
}) {
  const [open, setOpen] = useState(false)

  // Key includes the state so a student who was warned "expiring_soon" still
  // gets the "expired" popup once the subscription actually lapses.
  const seenKey = `${SEEN_KEY_PREFIX}${subscriptionId}:${state}`

  useEffect(() => {
    if (state === 'active') return
    if (localStorage.getItem(seenKey)) return
    const timer = setTimeout(() => setOpen(true), 600)
    return () => clearTimeout(timer)
  }, [seenKey, state])

  function dismiss() {
    localStorage.setItem(seenKey, '1')
    setOpen(false)
  }

  if (state === 'active') return null

  const content =
    state === 'expired'
      ? {
          icon: <SmileySad className="size-7 text-red-600" weight="bold" />,
          iconBg: 'bg-red-50',
          title: 'Votre abonnement a expiré',
          description: `Il s'est terminé le ${endDateLabel}. Rendez-vous à l'accueil pour le renouveler et continuer à profiter de l'espace.`,
        }
      : state === 'expires_today'
        ? {
            icon: <WarningCircle className="size-7 text-orange-600" weight="bold" />,
            iconBg: 'bg-orange-50',
            title: "Votre abonnement expire aujourd'hui",
            description: 'Pensez à le renouveler à l\'accueil pour ne pas perdre l\'accès demain.',
          }
        : {
            icon: <WarningCircle className="size-7 text-orange-600" weight="bold" />,
            iconBg: 'bg-orange-50',
            title: 'Votre abonnement expire bientôt',
            description: `Il se termine le ${endDateLabel}. Pensez à le renouveler à l'accueil.`,
          }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className={`flex size-14 items-center justify-center rounded-full ${content.iconBg}`}>
            {content.icon}
          </div>
          <DialogTitle className="mt-2">{content.title}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button onClick={dismiss}>Compris</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
