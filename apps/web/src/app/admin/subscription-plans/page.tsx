import { listSubscriptionPlans } from '@/data/admin/subscription-plans'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TogglePlanButton } from './toggle-plan-button'

export default async function SubscriptionPlansPage() {
  const plans = await listSubscriptionPlans()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Formules d'abonnement</h1>
        <Button asChild>
          <Link href="/admin/subscription-plans/new">Nouvelle formule</Link>
        </Button>
      </div>
      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Durée</th>
              <th className="text-left px-4 py-2">Prix</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{plan.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{plan.duration_days} jour(s)</td>
                <td className="px-4 py-2">{plan.price_dt} DT</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {plan.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <TogglePlanButton id={plan.id} isActive={plan.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
