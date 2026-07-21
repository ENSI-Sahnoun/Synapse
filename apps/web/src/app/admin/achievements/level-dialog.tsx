'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  upsertLevelAction,
  deleteLevelAction,
} from '@/actions/admin/achievements'
import {
  updateLevelSchema,
  type UpdateLevelInput,
} from '@/utils/zod-schemas/achievement'

interface Level {
  level: number
  xp_required: number
  label: string | null
}

type Props =
  | { mode: 'create'; level?: undefined }
  | { mode: 'edit'; level: Level }

export function LevelDialog({ mode, level }: Props) {
  const [open, setOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<UpdateLevelInput>({
    resolver: zodResolver(updateLevelSchema) as any,
    defaultValues:
      mode === 'edit'
        ? {
            level: level.level,
            xp_required: level.xp_required,
            label: level.label ?? '',
          }
        : {
            level: 1,
            xp_required: 0,
            label: '',
          },
  })

  const { execute: upsertLevel, status: upsertStatus } = useAction(
    upsertLevelAction,
    {
      onSuccess: () => {
        toast.success(mode === 'edit' ? 'Niveau mis à jour' : 'Niveau créé')
        form.reset()
        setOpen(false)
      },
      onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
    },
  )

  const { execute: deleteLevel, status: deleteStatus } = useAction(
    deleteLevelAction,
    {
      onSuccess: () => {
        toast.success('Niveau supprimé')
        setOpen(false)
      },
      onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
    },
  )

  const isExecuting =
    upsertStatus === 'executing' || deleteStatus === 'executing'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onSubmit(values: UpdateLevelInput) {
    upsertLevel(values)
  }

  function onDelete() {
    if (mode === 'edit') {
      deleteLevel({ level: level.level })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={mode === 'edit' ? 'ghost' : 'default'}
          size={mode === 'edit' ? 'sm' : 'default'}
        >
          {mode === 'edit' ? 'Modifier' : '+ Créer'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier le niveau' : 'Créer un nouveau niveau'}
          </DialogTitle>
        </DialogHeader>
        {!showDeleteConfirm && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
            <div className="space-y-1">
              <Label>Niveau *</Label>
              <Input
                type="number"
                {...form.register('level', { valueAsNumber: true })}
                placeholder="1"
                min="1"
                disabled={mode === 'edit'}
              />
              {form.formState.errors.level && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.level.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>XP requis *</Label>
              <Input
                type="number"
                {...form.register('xp_required', { valueAsNumber: true })}
                placeholder="0"
                min="0"
              />
              {form.formState.errors.xp_required && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.xp_required.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Libellé</Label>
              <Input
                {...form.register('label')}
                placeholder="ex: Novice"
              />
              {form.formState.errors.label && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.label.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isExecuting} className="w-full">
              {isExecuting
                ? mode === 'edit'
                  ? 'Mise à jour...'
                  : 'Création...'
                : mode === 'edit'
                  ? 'Mettre à jour'
                  : 'Créer le niveau'}
            </Button>

            {mode === 'edit' && (
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Supprimer
              </Button>
            )}
          </form>
        )}
        {showDeleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer ce niveau ? Cette action est irréversible.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isExecuting}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isExecuting}
                className="flex-1"
              >
                {isExecuting ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
