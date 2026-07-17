'use client'

import { motion, useReducedMotion } from 'motion/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { LoyaltyRule } from '@/lib/rewards'
import { RequestButton } from './request-button'
import { CancelButton } from './cancel-button'

export type RedemptionRequest = {
  id: string
  status: string
  points_used: number
  created_at: string
  loyalty_rules: { name: string } | null
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  fulfilled: 'Accordée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
}

const GOLD = '#c9a227'

function ProgressRing({ pct, unlocked }: { pct: number; unlocked: boolean }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--synapse-cream-300)" strokeWidth="4" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={unlocked ? GOLD : 'var(--synapse-green-500)'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--synapse-brown-700)">
        {Math.floor(Math.min(pct, 100))}%
      </text>
    </svg>
  )
}

export function RewardsPanel({
  balance,
  rules,
  pendingRuleIds,
  requests,
}: {
  balance: number
  rules: LoyaltyRule[]
  pendingRuleIds: string[]
  requests: RedemptionRequest[]
}) {
  const reduced = useReducedMotion()

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
            Aucune récompense active pour le moment.
          </p>
        )}
        {rules.map((rule, i) => {
          const canRedeem = balance >= rule.points_threshold
          const alreadyPending = pendingRuleIds.includes(rule.id)
          const pct = (balance / rule.points_threshold) * 100
          return (
            <motion.div
              key={rule.id}
              className="border rounded-xl p-4 flex items-center gap-4 bg-white"
              style={canRedeem ? { borderColor: GOLD, boxShadow: `0 0 0 1px ${GOLD}` } : { borderColor: 'var(--border-subtle)', opacity: 0.75 }}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: canRedeem ? 1 : 0.75, y: 0 }}
              transition={{ delay: reduced ? 0 : i * 0.06 }}
            >
              <ProgressRing pct={pct} unlocked={canRedeem} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{rule.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {REWARD_TYPE_LABELS[rule.reward_type] ?? rule.reward_type}
                  {rule.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
                </p>
                <p className="text-xs mt-0.5">
                  <span
                    className="font-semibold"
                    style={{ color: canRedeem ? GOLD : 'var(--muted-foreground)' }}
                  >
                    {rule.points_threshold} pts requis
                  </span>
                  {canRedeem && <span className="text-green-600 ml-2">✓ Disponible</span>}
                </p>
              </div>
              <RequestButton ruleId={rule.id} canRedeem={canRedeem} alreadyPending={alreadyPending} />
            </motion.div>
          )
        })}
      </section>

      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">Historique des demandes</h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between text-sm bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <p className="font-medium">{req.loyalty_rules?.name ?? 'Récompense'}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                  {req.status === 'pending' && <CancelButton requestId={req.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
