'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePushPrompt } from '@/hooks/use-push-prompt'
import { BellRing } from 'lucide-react'

export function PushPromptModal() {
  const { open, dismiss, enable } = usePushPrompt()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-blue-50">
            <BellRing className="size-7 text-blue-600" />
          </div>
          <DialogTitle className="mt-2">Ne manquez aucune alerte</DialogTitle>
          <DialogDescription>
            Activez les notifications pour être prévenu directement sur votre téléphone :
            expiration d&apos;abonnement, réservations, annonces importantes.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={dismiss}>
            Plus tard
          </Button>
          <Button onClick={() => void enable()}>Activer les notifications</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
