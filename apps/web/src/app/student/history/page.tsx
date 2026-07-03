import { getMyCheckInHistory, getMyCheckInCounts } from '@/data/student/profile'
import { differenceInMinutes, parseISO } from 'date-fns'
import { StudentHistoryClient } from './StudentHistoryClient'

export default async function StudentHistoryPage() {
  const [sessions, counts] = await Promise.all([getMyCheckInHistory(), getMyCheckInCounts()])

  const totalMins = sessions.reduce((sum, s) => {
    if (!s.checked_out_at) return sum
    return sum + differenceInMinutes(parseISO(s.checked_out_at), parseISO(s.checked_in_at))
  }, 0)
  const totalHours = Math.round(totalMins / 60)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Historique
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Vos visites — par année, mois et jour
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Visites', value: counts.total, color: 'var(--accent-brand)' },
          { label: 'Heures totales', value: totalHours, color: 'var(--synapse-orange-600)' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border p-4"
            style={{ background: 'white', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              {s.label}
            </p>
            <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <StudentHistoryClient sessions={sessions} />
    </div>
  )
}
