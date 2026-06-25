'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { setExamMode } from '@/actions/admin/settings'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ExamModeCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)

  const { execute, status } = useAction(setExamMode, {
    onSuccess: ({ data }) => {
      if (!data?.success) return
      setEnabled(data.examMode)
      toast.success(
        data.examMode
          ? "Mode examen activé — réservation obligatoire pour l'accès."
          : 'Mode examen désactivé.'
      )
    },
    onError: ({ error }) => {
      setEnabled((prev) => !prev) // revert optimistic toggle
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour.')
    },
  })

  function handleToggle(checked: boolean) {
    setEnabled(checked) // optimistic
    execute({ enabled: checked })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mode examen</CardTitle>
        <CardDescription>
          Lorsqu'il est activé, une réservation préalable est obligatoire pour tout accès à l'espace.
          Les étudiants sans réservation active seront refusés au scan QR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">{enabled ? 'Activé' : 'Désactivé'}</span>
            <span className="text-xs text-muted-foreground">
              {enabled
                ? "Les réservations sont obligatoires. File d'attente active."
                : 'Accès libre avec abonnement valide.'}
            </span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={status === 'executing'}
            aria-label="Activer le mode examen"
          />
        </div>
      </CardContent>
    </Card>
  )
}
