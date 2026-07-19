'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'

type FormValues = {
  id: string
  name?: string
  duration_days?: number
  price_dt?: number
  tax_rate_pct?: number
}

interface EditPlanFormProps {
  plan: { id: string; name: string; duration_days: number; price_dt: number; tax_rate_pct: number }
}

export function EditPlanForm({ plan }: EditPlanFormProps) {
  const router = useRouter()
  const form = useForm<FormValues>({
    defaultValues: {
      id: plan.id,
      name: plan.name,
      duration_days: plan.duration_days,
      price_dt: plan.price_dt,
      tax_rate_pct: plan.tax_rate_pct,
    },
  })

  const { execute, status } = useAction(updatePlanAction, {
    onSuccess: () => {
      toast.success('Formule mise à jour')
      router.push('/admin/subscription-plans')
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4 max-w-sm">
      <input type="hidden" {...form.register('id')} />

      <div className="space-y-1">
        <Label>Nom *</Label>
        <Input {...form.register('name')} placeholder="ex: Mensuel" />
      </div>

      <div className="space-y-1">
        <Label>Durée (jours) *</Label>
        <Input type="number" {...form.register('duration_days', { valueAsNumber: true })} />
      </div>

      <div className="space-y-1">
        <Label>Prix (DT) *</Label>
        <Input type="number" step="0.001" min="0" {...form.register('price_dt', { valueAsNumber: true })} />
      </div>

      <div className="space-y-1">
        <Label>TAX (%)</Label>
        <Input type="number" step="1" min="0" max="100" {...form.register('tax_rate_pct', { valueAsNumber: true })} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/subscription-plans')}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
