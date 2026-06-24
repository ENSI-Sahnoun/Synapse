'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { adminUpdateSubscriptionAction } from '@/actions/admin/subscriptions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Plan {
  id: string
  name: string
  duration_days: number
  price_dt: number
}

interface ActiveSubscription {
  id: string
  start_date: string
  end_date: string
  paid_amount: number
  plan_id: string
  subscription_plans: { id: string; name: string; duration_days: number; price_dt: number } | null
}

interface SubscriptionEditorProps {
  subscription: ActiveSubscription | null
  plans: Plan[]
  studentId: string
}

export function SubscriptionEditor({ subscription, plans, studentId }: SubscriptionEditorProps) {
  const [newEndDate, setNewEndDate] = useState(subscription?.end_date ?? '')
  const [newPlanId, setNewPlanId] = useState(subscription?.plan_id ?? '')

  const { execute, status } = useAction(adminUpdateSubscriptionAction, {
    onSuccess: () => toast.success('Abonnement mis à jour'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (!subscription) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Aucun abonnement actif.{' '}
        <a href={`/employee/students/${studentId}`} className="underline">
          Ajouter via l&apos;interface employé
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="rounded-md border p-4 space-y-1 text-sm bg-muted/30">
        <p className="font-medium">{subscription.subscription_plans?.name ?? '—'}</p>
        <p className="text-muted-foreground">
          Du {format(parseISO(subscription.start_date), 'dd MMM yyyy', { locale: fr })} au{' '}
          {format(parseISO(subscription.end_date), 'dd MMM yyyy', { locale: fr })}
        </p>
        <p className="text-muted-foreground">Payé : {subscription.paid_amount} DT</p>
      </div>

      <div className="space-y-1">
        <Label>Changer la formule</Label>
        <select
          value={newPlanId}
          onChange={(e) => setNewPlanId(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.duration_days}j — {p.price_dt} DT
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label>Modifier la date de fin</Label>
        <Input
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() =>
            execute({
              subscription_id: subscription.id,
              end_date: newEndDate !== subscription.end_date ? newEndDate : undefined,
              plan_id: newPlanId !== subscription.plan_id ? newPlanId : undefined,
            })
          }
          disabled={status === 'executing'}
        >
          {status === 'executing' ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!window.confirm('Annuler cet abonnement ? Il expirera immédiatement.')) return
            execute({ subscription_id: subscription.id, cancel: true })
          }}
          disabled={status === 'executing'}
        >
          Annuler l&apos;abonnement
        </Button>
      </div>
    </div>
  )
}
