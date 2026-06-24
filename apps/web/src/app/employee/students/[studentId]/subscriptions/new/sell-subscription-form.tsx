'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSubscriptionAction } from '@/actions/employee/subscriptions'
import { Button } from '@/components/ui/button'
import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Plan {
  id: string
  name: string
  duration_days: number
  price_dt: number
}

interface Props {
  studentId: string
  plans: Plan[]
  stackStartDate: string
}

export function SellSubscriptionForm({ studentId, plans, stackStartDate }: Props) {
  const router = useRouter()
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
  const previewEndDate = selectedPlan
    ? format(addDays(parseISO(stackStartDate), selectedPlan.duration_days), 'dd MMMM yyyy', { locale: fr })
    : null

  const { execute, status } = useAction(createSubscriptionAction, {
    onSuccess: ({ data }) => {
      toast.success(`Abonnement créé — ${data?.pointsEarned} point(s) Synapse attribué(s)`)
      router.push(`/employee/students/${studentId}`)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <p className="text-sm font-medium">Choisir une formule</p>
        <div className="grid gap-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={`border rounded-md p-3 text-left text-sm transition-colors ${
                selectedPlanId === plan.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{plan.name}</span>
                <span className="font-semibold">{plan.price_dt} DT</span>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">{plan.duration_days} jour(s)</p>
            </button>
          ))}
        </div>
      </div>

      {selectedPlan && (
        <div className="bg-muted rounded-md p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Début:</span>
            <span>{format(parseISO(stackStartDate), 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex justify-between">
            <span>Fin:</span>
            <span className="font-medium">{previewEndDate}</span>
          </div>
          <div className="flex justify-between">
            <span>Montant:</span>
            <span className="font-semibold">{selectedPlan.price_dt} DT (espèces)</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Points Synapse:</span>
            <span>+{Math.floor(selectedPlan.price_dt)} pts</span>
          </div>
        </div>
      )}

      <Button
        disabled={!selectedPlanId || status === 'executing'}
        onClick={() => execute({ student_id: studentId, plan_id: selectedPlanId })}
        className="w-full"
      >
        {status === 'executing' ? 'Enregistrement...' : 'Confirmer la vente'}
      </Button>
    </div>
  )
}
