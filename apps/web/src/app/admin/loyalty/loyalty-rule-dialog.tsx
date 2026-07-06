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
import { createLoyaltyRuleAction, updateLoyaltyRuleAction } from '@/actions/admin/loyalty-rules'
import {
  createLoyaltyRuleSchema,
  type CreateLoyaltyRuleInput,
  REWARD_TYPES,
} from '@/utils/zod-schemas/loyalty-rule'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

interface LoyaltyRule {
  id: string
  name: string
  reward_type: string
  points_threshold: number
  reward_value: number
  redemption_cost_dt: number
  is_active: boolean
}

type Props =
  | { mode: 'create'; rule?: undefined }
  | { mode: 'edit'; rule: LoyaltyRule }

export function LoyaltyRuleDialog({ mode, rule }: Props) {
  const [open, setOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateLoyaltyRuleInput>({
    resolver: zodResolver(createLoyaltyRuleSchema) as any,
    defaultValues:
      mode === 'edit'
        ? {
            name: rule.name,
            reward_type: rule.reward_type as CreateLoyaltyRuleInput['reward_type'],
            points_threshold: rule.points_threshold,
            reward_value: rule.reward_value,
            redemption_cost_dt: rule.redemption_cost_dt,
          }
        : { name: '', reward_type: 'free_day', points_threshold: 30, reward_value: 0, redemption_cost_dt: 0 },
  })

  const watchedType = form.watch('reward_type')

  const { execute: createRule, status: createStatus } = useAction(createLoyaltyRuleAction, {
    onSuccess: () => {
      toast.success('Règle créée')
      form.reset()
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: updateRule, status: updateStatus } = useAction(updateLoyaltyRuleAction, {
    onSuccess: () => {
      toast.success('Règle mise à jour')
      setOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const isExecuting = createStatus === 'executing' || updateStatus === 'executing'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onSubmit(values: CreateLoyaltyRuleInput) {
    if (mode === 'edit') {
      updateRule({ id: rule.id, ...values })
    } else {
      createRule(values)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === 'edit' ? 'ghost' : 'default'} size={mode === 'edit' ? 'sm' : 'default'}>
          {mode === 'edit' ? 'Modifier' : 'Nouvelle règle'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier la règle' : 'Nouvelle règle de fidélité'}
          </DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nom *</Label>
            <Input {...form.register('name')} placeholder="ex: Journée gratuite" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Type de récompense *</Label>
            <Select
              value={form.watch('reward_type')}
              onValueChange={(v) =>
                form.setValue('reward_type', v as CreateLoyaltyRuleInput['reward_type'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWARD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REWARD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Seuil de points *</Label>
            <Input type="number" {...form.register('points_threshold', { valueAsNumber: true })} />
            {form.formState.errors.points_threshold && (
              <p className="text-sm text-destructive">
                {form.formState.errors.points_threshold.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Coût récompense (DT)</Label>
            <Input type="number" step="0.1" min="0" {...form.register('redemption_cost_dt', { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">
              Montant déduit en dépense à chaque échange (0 = aucune dépense).
            </p>
            {form.formState.errors.redemption_cost_dt && (
              <p className="text-sm text-destructive">{form.formState.errors.redemption_cost_dt.message}</p>
            )}
          </div>
          {watchedType === 'discount_pct' && (
            <div className="space-y-1">
              <Label>Valeur de la réduction (%) *</Label>
              <Input type="number" step="1" {...form.register('reward_value', { valueAsNumber: true })} />
              {form.formState.errors.reward_value && (
                <p className="text-sm text-destructive">{form.formState.errors.reward_value.message}</p>
              )}
            </div>
          )}
          <Button type="submit" disabled={isExecuting} className="w-full">
            {isExecuting
              ? 'Enregistrement...'
              : mode === 'edit'
              ? 'Mettre à jour'
              : 'Créer la règle'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
