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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createAchievementAction,
  updateAchievementAction,
} from '@/actions/admin/achievements'
import {
  createAchievementSchema,
  ACHIEVEMENT_CATEGORIES,
  type CreateAchievementInput,
} from '@/utils/zod-schemas/achievement'
import { ACHIEVEMENT_ICON_NAMES, resolveAchievementIcon } from '@/utils/achievement-icons'

interface Achievement {
  id: string
  category: string
  threshold: number | null
  points: number
  title: string
  description: string | null
  emoji: string
  sort_order: number
  is_active: boolean
}

type Props =
  | { mode: 'create'; achievement?: undefined }
  | { mode: 'edit'; achievement: Achievement }

const CATEGORY_LABELS: Record<string, string> = {
  visits: 'Visites',
  hours: 'Heures',
  spend: 'Dépenses',
  purchase_count: 'Nombre d\'achats',
  streak: 'Séquence',
  manual: 'Attribution manuelle',
}

export function AchievementDialog({ mode, achievement }: Props) {
  const [open, setOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateAchievementInput>({
    resolver: zodResolver(createAchievementSchema) as any,
    defaultValues:
      mode === 'edit'
        ? {
            category: achievement.category as CreateAchievementInput['category'],
            threshold: achievement.threshold,
            points: achievement.points,
            title: achievement.title,
            description: achievement.description ?? '',
            emoji: achievement.emoji,
            sort_order: achievement.sort_order,
          }
        : {
            category: 'manual',
            threshold: null,
            points: 0,
            title: '',
            description: '',
            emoji: 'Trophy',
            sort_order: 0,
          },
  })

  const watchedCategory = form.watch('category')

  const { execute: createAchievement, status: createStatus } = useAction(
    createAchievementAction,
    {
      onSuccess: () => {
        toast.success('Succès créé')
        form.reset()
        setOpen(false)
      },
      onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
    },
  )

  const { execute: updateAchievement, status: updateStatus } = useAction(
    updateAchievementAction,
    {
      onSuccess: () => {
        toast.success('Succès mis à jour')
        setOpen(false)
      },
      onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
    },
  )

  const isExecuting = createStatus === 'executing' || updateStatus === 'executing'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onSubmit(values: CreateAchievementInput) {
    if (mode === 'edit') {
      updateAchievement({ id: achievement.id, ...values })
    } else {
      createAchievement(values)
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
            {mode === 'edit'
              ? 'Modifier le succès'
              : 'Créer un nouveau succès'}
          </DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
          <div className="space-y-1">
            <Label>Catégorie *</Label>
            <Select
              value={form.watch('category')}
              onValueChange={(v) =>
                form.setValue(
                  'category',
                  v as CreateAchievementInput['category'],
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACHIEVEMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category && (
              <p className="text-sm text-destructive">
                {form.formState.errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Titre *</Label>
            <Input
              {...form.register('title')}
              placeholder="ex: 10 visites"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Icône</Label>
            <Select
              value={form.watch('emoji')}
              onValueChange={(v) => form.setValue('emoji', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACHIEVEMENT_ICON_NAMES.map((name) => {
                  const Icon = resolveAchievementIcon(name)
                  return (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        <Icon size={16} />
                        {name}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {form.formState.errors.emoji && (
              <p className="text-sm text-destructive">
                {form.formState.errors.emoji.message}
              </p>
            )}
          </div>

          {watchedCategory !== 'manual' && (
            <div className="space-y-1">
              <Label>Seuil *</Label>
              <Input
                type="number"
                {...form.register('threshold', { valueAsNumber: true })}
                placeholder="ex: 10"
              />
              {form.formState.errors.threshold && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.threshold.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Points *</Label>
            <Input
              type="number"
              {...form.register('points', { valueAsNumber: true })}
              placeholder="0"
              min="0"
            />
            {form.formState.errors.points && (
              <p className="text-sm text-destructive">
                {form.formState.errors.points.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              {...form.register('description')}
              placeholder="Description optionnelle"
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Ordre d'affichage</Label>
            <Input
              type="number"
              {...form.register('sort_order', { valueAsNumber: true })}
              placeholder="0"
            />
            {form.formState.errors.sort_order && (
              <p className="text-sm text-destructive">
                {form.formState.errors.sort_order.message}
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
                : 'Créer le succès'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
