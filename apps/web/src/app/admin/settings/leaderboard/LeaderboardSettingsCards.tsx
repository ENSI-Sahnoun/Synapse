'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { setLeaderboardFlags, updateLeaderboardCategory } from '@/actions/admin/leaderboard-config'
import type { LeaderboardSettings, LeaderboardConfigRow } from '@/data/student/leaderboard'

export function LeaderboardSettingsCards({
  initialSettings,
  initialConfig,
}: {
  initialSettings: LeaderboardSettings
  initialConfig: LeaderboardConfigRow[]
}) {
  const [settings, setSettings] = useState(initialSettings)
  const { execute: execFlags } = useAction(setLeaderboardFlags, {
    onSuccess: () => toast.success('Paramètres mis à jour.'),
    onError: () => toast.error('Erreur lors de la mise à jour.'),
  })

  function patchFlags(patch: Partial<LeaderboardSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    execFlags(patch)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Général</CardTitle>
          <CardDescription>Activation et affichage du classement.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Classement activé</span>
            <Switch checked={settings.enabled} onCheckedChange={(v) => patchFlags({ enabled: v })} aria-label="Activer le classement" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Prix mystère</span>
              <span className="text-xs text-muted-foreground">Masque les points aux étudiants jusqu'à la remise.</span>
            </div>
            <Switch checked={settings.prizeSecret} onCheckedChange={(v) => patchFlags({ prizeSecret: v })} aria-label="Prix mystère" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Nombre de rangs affichés</span>
            <Input
              type="number"
              min={3}
              max={50}
              defaultValue={settings.listSize}
              className="w-24"
              onBlur={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n) && n >= 3 && n <= 50) patchFlags({ listSize: n })
              }}
            />
          </div>
        </CardContent>
      </Card>

      {initialConfig.map((cat) => (
        <CategoryCard key={cat.category} initial={cat} />
      ))}
    </div>
  )
}

function CategoryCard({ initial }: { initial: LeaderboardConfigRow }) {
  const [row, setRow] = useState(initial)
  const { execute } = useAction(updateLeaderboardCategory, {
    onSuccess: () => toast.success('Catégorie mise à jour.'),
    onError: () => toast.error('Erreur lors de la mise à jour.'),
  })

  function save(next: LeaderboardConfigRow) {
    setRow(next)
    execute({
      category: next.category,
      enabled: next.enabled,
      label: next.label,
      emoji: next.emoji,
      points_1: next.points_1,
      points_2: next.points_2,
      points_3: next.points_3,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{row.emoji}</span> {row.label}
        </CardTitle>
        <CardDescription>Catégorie « {row.category} ».</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Activée</span>
          <Switch checked={row.enabled} onCheckedChange={(v) => save({ ...row, enabled: v })} aria-label={`Activer ${row.category}`} />
        </div>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-muted-foreground">Nom affiché</span>
            <Input defaultValue={row.label} onBlur={(e) => e.target.value.trim() && save({ ...row, label: e.target.value.trim() })} />
          </label>
          <label className="flex flex-col gap-1 w-20">
            <span className="text-xs text-muted-foreground">Emoji</span>
            <Input defaultValue={row.emoji} onBlur={(e) => e.target.value.trim() && save({ ...row, emoji: e.target.value.trim() })} />
          </label>
        </div>
        <div className="flex gap-3">
          {([1, 2, 3] as const).map((rank) => {
            const key = `points_${rank}` as 'points_1' | 'points_2' | 'points_3'
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
            return (
              <label key={rank} className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-muted-foreground">{medal} points</span>
                <Input
                  type="number"
                  min={0}
                  defaultValue={row[key]}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (!Number.isNaN(n) && n >= 0) save({ ...row, [key]: n })
                  }}
                />
              </label>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
