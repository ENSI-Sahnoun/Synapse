import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import {
  getStudentLoyaltyBalance,
  getStudentLoyaltyLedger,
  getActiveLoyaltyRules,
  getStudentPendingRequestRuleIds,
  getStudentRedemptionRequests,
} from '@/data/student/loyalty'
import { RequestButton } from './request-button'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

const REASON_LABELS: Record<string, string> = {
  subscription: 'Abonnement',
  purchase: 'Achat en magasin',
  redemption: 'Échange de récompense',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  fulfilled: 'Accordée',
  rejected: 'Refusée',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function StudentLoyaltyPage() {
  const supabase = await createSupabaseClient()
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data?.user) redirect('/login')
  const studentId = data.user.id

  const [balance, ledger, rules, pendingRuleIds, requests] = await Promise.all([
    getStudentLoyaltyBalance(studentId),
    getStudentLoyaltyLedger(studentId),
    getActiveLoyaltyRules(),
    getStudentPendingRequestRuleIds(studentId),
    getStudentRedemptionRequests(studentId),
  ])

  return (
    <div className="space-y-6 pb-8">
      {/* Balance card */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
        <p className="text-sm font-medium opacity-80">Points Synapse</p>
        <p className="text-5xl font-bold mt-1">{balance}</p>
        <p className="text-xs opacity-70 mt-2">1 DT dépensé = 1 point</p>
      </div>

      {/* Redeemable rewards */}
      <section className="space-y-3">
        <h2 className="font-semibold text-base">Récompenses disponibles</h2>
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune récompense active pour le moment.</p>
        )}
        {rules.map((rule) => {
          const canRedeem = balance >= rule.points_threshold
          const alreadyPending = pendingRuleIds.includes(rule.id)
          return (
            <div
              key={rule.id}
              className={`border rounded-lg p-4 flex items-center justify-between gap-4 ${
                canRedeem ? 'border-primary/30 bg-primary/5' : 'opacity-60'
              }`}
            >
              <div>
                <p className="font-medium text-sm">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {REWARD_TYPE_LABELS[rule.reward_type] ?? rule.reward_type}
                  {rule.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
                </p>
                <p className="text-xs mt-0.5">
                  <span className={canRedeem ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                    {rule.points_threshold} pts requis
                  </span>
                  {canRedeem && (
                    <span className="text-green-600 ml-2">✓ Disponible</span>
                  )}
                </p>
              </div>
              <RequestButton
                ruleId={rule.id}
                canRedeem={canRedeem}
                alreadyPending={alreadyPending}
              />
            </div>
          )
        })}
      </section>

      {/* Redemption request history */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">Historique des demandes</h2>
          <div className="space-y-2">
            {requests.map((req) => {
              const rule = req.loyalty_rules as { name: string } | null
              return (
                <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{rule?.name ?? 'Récompense'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Ledger history */}
      {ledger.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">Historique des points</h2>
          <div className="divide-y border rounded-lg">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <p>{REASON_LABELS[entry.reason] ?? entry.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    entry.points_delta >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {entry.points_delta >= 0 ? '+' : ''}{entry.points_delta} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ledger.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun point gagné pour le moment. Achetez un abonnement ou un produit pour commencer.
        </p>
      )}
    </div>
  )
}
