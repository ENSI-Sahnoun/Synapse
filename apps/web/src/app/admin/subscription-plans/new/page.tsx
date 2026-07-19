'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSubscriptionPlanSchema, type CreateSubscriptionPlanInput } from '@/utils/zod-schemas/subscription-plan'
import Link from 'next/link'

export default function NewSubscriptionPlanPage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateSubscriptionPlanInput>({
    resolver: zodResolver(createSubscriptionPlanSchema) as any,
    defaultValues: { name: '', duration_days: 30, price_dt: 70, tax_rate_pct: 0 },
  })

  const { execute, status } = useAction(createPlanAction, {
    onSuccess: () => { toast.success('Formule créée'); router.push('/admin/subscription-plans') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/subscription-plans" className="text-sm text-muted-foreground hover:underline">
        ← Formules
      </Link>
      <h1 className="text-2xl font-semibold">Nouvelle formule</h1>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-sm">
        <div className="space-y-1">
          <Label>Nom *</Label>
          <Input {...form.register('name')} placeholder="ex: Mensuel" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Durée (jours) *</Label>
          <Input type="number" {...form.register('duration_days')} />
          {form.formState.errors.duration_days && (
            <p className="text-sm text-destructive">{form.formState.errors.duration_days.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Prix (DT) *</Label>
          <Input type="number" step="0.001" min="0" {...form.register('price_dt')} />
        </div>
        <div className="space-y-1">
          <Label>TAX (%)</Label>
          <Input type="number" step="1" min="0" max="100" {...form.register('tax_rate_pct')} />
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Création...' : 'Créer la formule'}
        </Button>
      </form>
    </div>
  )
}
