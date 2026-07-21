'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PencilSimple, Trash, X, Check, Prohibit } from '@phosphor-icons/react'
import { updateSubscriptionAction, deleteSubscriptionAction } from '@/actions/admin/subscriptions'

interface Plan {
  id: string
  name: string
}

interface HistoryRow {
  id: string
  planId: string
  planName: string
  startDate: string
  endDate: string
  paidAmount: number
  voidedAt: string | null
}

function SubscriptionRow({ row, plans }: { row: HistoryRow; plans: Plan[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [planId, setPlanId] = useState(row.planId)
  const [startDate, setStartDate] = useState(row.startDate.slice(0, 10))
  const [endDate, setEndDate] = useState(row.endDate.slice(0, 10))

  const { execute: doUpdate, status: updateStatus } = useAction(updateSubscriptionAction, {
    onSuccess: () => {
      toast.success('Abonnement mis à jour')
      setEditing(false)
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: doDelete, status: deleteStatus } = useAction(deleteSubscriptionAction, {
    onSuccess: () => {
      toast.success('Abonnement supprimé')
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const busy = updateStatus === 'executing' || deleteStatus === 'executing'

  if (editing) {
    return (
      <div className="border rounded-md p-3 space-y-2">
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="w-full border rounded-md p-2 text-sm"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 border rounded-md p-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 border rounded-md p-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            disabled={busy}
            className="flex-1 border rounded-md p-2 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <X size={14} /> Annuler
          </button>
          <button
            onClick={() => doUpdate({
              subscription_id: row.id,
              plan_id: planId !== row.planId ? planId : undefined,
              start_date: startDate !== row.startDate.slice(0, 10) ? startDate : undefined,
              end_date: endDate !== row.endDate.slice(0, 10) ? endDate : undefined,
            })}
            disabled={busy}
            className="flex-1 bg-primary text-primary-foreground rounded-md p-2 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <Check size={14} /> {updateStatus === 'executing' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    )
  }

  const cancelled = row.voidedAt !== null

  return (
    <div className={`flex justify-between items-center border rounded-md p-3 gap-2 ${cancelled ? 'opacity-60' : ''}`}>
      <div>
        <div className="text-sm font-medium flex items-center gap-2">
          {row.planName}
          {cancelled && (
            <span className="text-xs font-semibold text-destructive border border-destructive/30 rounded px-1.5 py-0.5">
              Annulé
            </span>
          )}
        </div>
        <div className={`text-xs text-muted-foreground ${cancelled ? 'line-through' : ''}`}>
          {new Date(row.startDate).toLocaleDateString('fr-FR')} → {new Date(row.endDate).toLocaleDateString('fr-FR')}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${cancelled ? 'line-through' : ''}`}>{row.paidAmount} DT</span>
        {!cancelled && (
          <>
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              title="Modifier"
              className="text-muted-foreground"
            >
              <PencilSimple size={16} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Annuler cet abonnement ? Les points de fidélité gagnés seront repris.')) {
                  doUpdate({ subscription_id: row.id, cancel: true })
                }
              }}
              disabled={busy}
              title="Annuler l'abonnement"
              className="text-muted-foreground"
            >
              <Prohibit size={16} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Supprimer définitivement cet abonnement ? (réservé aux administrateurs)')) doDelete({ subscription_id: row.id })
              }}
              disabled={busy}
              title="Supprimer (admin)"
              className="text-destructive"
            >
              <Trash size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function SubscriptionHistory({ history, plans }: { history: HistoryRow[]; plans: Plan[] }) {
  if (history.length === 0) return null

  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-sm font-medium">Historique des abonnements</p>
      <div className="space-y-2">
        {history.map((row) => (
          <SubscriptionRow key={row.id} row={row} plans={plans} />
        ))}
      </div>
    </div>
  )
}
