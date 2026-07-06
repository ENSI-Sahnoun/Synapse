'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { setFreeSwap } from '@/actions/admin/settings'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function FreeSwapCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)

  const { execute, status } = useAction(setFreeSwap, {
    onSuccess: ({ data }) => {
      if (!data?.success) return
      setEnabled(data.freeSwap)
      toast.success(
        data.freeSwap
          ? 'Changement de place libre activé — les étudiants peuvent se déplacer sans validation.'
          : 'Changement de place libre désactivé — validation du personnel requise.',
      )
    },
    onError: ({ error }) => {
      setEnabled((prev) => !prev)
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour.')
    },
  })

  function handleToggle(checked: boolean) {
    setEnabled(checked)
    execute({ enabled: checked })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liberté de changement de place</CardTitle>
        <CardDescription>
          Lorsqu&apos;elle est activée, un étudiant déjà installé peut se déplacer vers n&apos;importe quelle
          place libre sans attendre la validation d&apos;un employé. Les administrateurs sont notifiés de
          chaque déplacement (ex. « Anis est passé de A1 à B3 »).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">{enabled ? 'Activé' : 'Désactivé'}</span>
            <span className="text-xs text-muted-foreground">
              {enabled
                ? 'Déplacement instantané vers une place libre.'
                : 'Chaque changement doit être validé par le personnel.'}
            </span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={status === 'executing'}
            aria-label="Activer la liberté de changement de place"
          />
        </div>
      </CardContent>
    </Card>
  )
}
