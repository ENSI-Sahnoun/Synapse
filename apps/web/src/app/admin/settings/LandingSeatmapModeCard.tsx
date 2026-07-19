'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { setLandingSeatmapMode } from '@/actions/admin/settings'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LandingSeatmapModeCard({ initialMode }: { initialMode: 'mock' | 'real' }) {
  const [real, setReal] = useState(initialMode === 'real')

  const { execute, status } = useAction(setLandingSeatmapMode, {
    onSuccess: ({ data }) => {
      if (!data?.success) return
      setReal(data.mode === 'real')
      toast.success(
        data.mode === 'real'
          ? 'La vitrine affiche maintenant l’occupation réelle des salles.'
          : 'La vitrine affiche maintenant des données de démonstration.'
      )
    },
    onError: ({ error }) => {
      setReal((prev) => !prev) // revert optimistic toggle
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour.')
    },
  })

  function handleToggle(checked: boolean) {
    setReal(checked) // optimistic
    execute({ mode: checked ? 'real' : 'mock' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan de salle sur la page d’accueil</CardTitle>
        <CardDescription>
          Le widget de la page d’accueil publique peut afficher une simulation, ou l’occupation
          réelle (agrégée, sans données personnelles) de toutes les salles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">{real ? 'Données réelles' : 'Démonstration'}</span>
            <span className="text-xs text-muted-foreground">
              {real
                ? 'Le nombre de places occupées provient des salles en temps réel.'
                : 'Le widget anime une simulation, indépendante des salles réelles.'}
            </span>
          </div>
          <Switch
            checked={real}
            onCheckedChange={handleToggle}
            disabled={status === 'executing'}
            aria-label="Afficher l’occupation réelle sur la page d’accueil"
          />
        </div>
      </CardContent>
    </Card>
  )
}
