'use client'

import { motion, useReducedMotion } from 'motion/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export type LedgerEntry = {
  id: string
  points_delta: number
  reason: string
  created_at: string
}

const REASON_LABELS: Record<string, string> = {
  subscription: 'Abonnement',
  purchase: 'Achat en magasin',
  redemption: 'Échange de récompense',
}

export function HistoryPanel({ ledger }: { ledger: LedgerEntry[] }) {
  const reduced = useReducedMotion()

  if (ledger.length === 0) {
    return (
      <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
        Aucun point gagné pour le moment. Achetez un abonnement ou un produit pour commencer.
      </p>
    )
  }

  return (
    <div className="divide-y border rounded-xl bg-white overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      {ledger.map((entry, i) => (
        <motion.div
          key={entry.id}
          className="flex items-center justify-between px-4 py-2.5 text-sm"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          // Cap the stagger — the ledger is unbounded, so an uncapped delay
          // would leave the tail of a long history invisible for seconds.
          transition={{ delay: reduced ? 0 : Math.min(i, 8) * 0.03 }}
        >
          <div>
            <p>{REASON_LABELS[entry.reason] ?? entry.reason}</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {format(new Date(entry.created_at), 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>
          <span className={`font-semibold ${entry.points_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {entry.points_delta >= 0 ? '+' : ''}{entry.points_delta} pts
          </span>
        </motion.div>
      ))}
    </div>
  )
}
