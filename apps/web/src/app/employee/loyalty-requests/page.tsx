import {
  listPendingRedemptionRequests,
  listRecentFulfilledRequests,
} from '@/data/employee/loyalty-requests'
import { RequestActions } from './request-actions'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_day: 'Journée gratuite',
  free_coffee: 'Café offert',
  discount_pct: 'Réduction %',
}

export default async function EmployeeLoyaltyRequestsPage() {
  const [pending, recent] = await Promise.all([
    listPendingRedemptionRequests(),
    listRecentFulfilledRequests(20),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Demandes de récompenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Validez physiquement la récompense, puis confirmez dans le système.
        </p>
      </div>

      {/* Pending requests */}
      <section className="space-y-3">
        <h2 className="font-medium text-base flex items-center gap-2">
          En attente
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </h2>

        {pending.length === 0 && (
          <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Aucune demande en attente.
          </div>
        )}

        {pending.map((req) => {
          const student = req.student as { id: string; full_name: string; phone: string | null } | null
          const rule = req.rule as { id: string; name: string; reward_type: string; reward_value: number } | null
          return (
            <div
              key={req.id}
              className="border rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <p className="font-medium text-sm">{student?.full_name ?? 'Étudiant inconnu'}</p>
                {student?.phone && (
                  <p className="text-xs text-muted-foreground">{student.phone}</p>
                )}
                <p className="text-sm">
                  <span className="font-medium">{rule?.name ?? 'Récompense'}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {REWARD_TYPE_LABELS[rule?.reward_type ?? ''] ?? rule?.reward_type}
                    {rule?.reward_type === 'discount_pct' && ` — ${rule.reward_value}%`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {req.points_used} pts · Demandé le{' '}
                  {format(new Date(req.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
              <RequestActions requestId={req.id} />
            </div>
          )
        })}
      </section>

      {/* Recent handled */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-base">Traitées récemment</h2>
          <div className="border rounded-lg divide-y">
            {recent.map((req) => {
              const student = req.student as { id: string; full_name: string } | null
              const rule = req.rule as { id: string; name: string; reward_type: string } | null
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{student?.full_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule?.name} · {req.points_used} pts
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'fulfilled'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {req.status === 'fulfilled' ? 'Accordée' : 'Refusée'}
                    </span>
                    {req.handled_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(req.handled_at), 'dd MMM HH:mm', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
