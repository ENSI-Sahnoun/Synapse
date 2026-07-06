import { listLoyaltyRules } from '@/data/admin/loyalty-rules'
import { LoyaltyRuleDialog } from './loyalty-rule-dialog'
import { ToggleRuleButton } from './toggle-rule-button'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

export default async function AdminLoyaltyPage() {
  const rules = await listLoyaltyRules()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Règles de fidélité</h1>
          <p className="text-sm text-muted-foreground mt-1">
            1 DT dépensé = 1 point Synapse. Les récompenses sont débloquées selon le seuil de points.
          </p>
        </div>
        <LoyaltyRuleDialog mode="create" />
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Seuil (pts)</th>
              <th className="text-left px-4 py-2">Valeur</th>
              <th className="text-left px-4 py-2">Coût (DT)</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Aucune règle définie.
                </td>
              </tr>
            )}
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{rule.name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {REWARD_TYPE_LABELS[rule.reward_type] ?? rule.reward_type}
                </td>
                <td className="px-4 py-2">{rule.points_threshold} pts</td>
                <td className="px-4 py-2">
                  {rule.reward_type === 'discount_pct' ? `${rule.reward_value}%` : '—'}
                </td>
                <td className="px-4 py-2">
                  {rule.redemption_cost_dt > 0 ? `${rule.redemption_cost_dt} DT` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      rule.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2 flex items-center gap-2">
                  <LoyaltyRuleDialog mode="edit" rule={rule} />
                  <ToggleRuleButton id={rule.id} isActive={rule.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
