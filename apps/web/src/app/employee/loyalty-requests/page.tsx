import { Suspense } from 'react'
import {
  listPendingRedemptionRequests,
  listRecentFulfilledRequests,
} from '@/data/employee/loyalty-requests'
import { PendingRequestRow, type PendingRequestRowData } from './PendingRequestRow'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { UserAvatar } from '@/components/user/UserAvatar'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function EmployeeLoyaltyRequestsPage() {
  const [pending, recent] = await Promise.all([
    listPendingRedemptionRequests(),
    listRecentFulfilledRequests(20),
  ])

  return (
    <div className="p-4 space-y-8 pb-24">
      <LiveRefresher tables={['loyalty_redemption_requests']} />
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

        <Suspense>
          {pending.map((req) => (
            <PendingRequestRow
              key={req.id}
              request={{
                id: req.id,
                points_used: req.points_used,
                created_at: req.created_at,
                student: req.student as PendingRequestRowData['student'],
                rule: req.rule as PendingRequestRowData['rule'],
              }}
            />
          ))}
        </Suspense>
      </section>

      {/* Recent handled */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-base">Traitées récemment</h2>
          <div className="border rounded-lg divide-y">
            {recent.map((req) => {
              const student = req.student as { id: string; full_name: string; avatar_url: string | null } | null
              const rule = req.rule as { id: string; name: string; reward_type: string } | null
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar fullName={student?.full_name} avatarUrl={student?.avatar_url} className="h-8 w-8" />
                    <div>
                      <p className="font-medium">{student?.full_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule?.name} · {req.points_used} pts
                      </p>
                    </div>
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
