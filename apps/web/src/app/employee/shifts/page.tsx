import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { ClockButton } from '@/components/employee/ClockButton'

export const dynamic = 'force-dynamic'

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function formatTime(time: string) {
  return time.slice(0, 5)
}

export default async function ShiftsPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: schedule } = await supabase
    .from('weekly_schedules')
    .select('day_of_week, start_time, end_time, role')
    .eq('employee_id', userId)
    .order('day_of_week', { ascending: true })

  const days = schedule ?? []

  const now = new Date()
  const todayDow = (now.getDay() + 6) % 7 // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  const nowTime = now.toTimeString().slice(0, 8)
  const today = days.find((d) => d.day_of_week === todayDow)
  const onShiftNow = !!today && nowTime >= today.start_time && nowTime < today.end_time

  const { data: openClock } = await supabase
    .from('employee_attendance')
    .select('id')
    .eq('employee_id', userId)
    .is('clock_out', null)
    .maybeSingle()

  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LiveRefresher tables={['weekly_schedules', 'employee_attendance']} />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Mes horaires</h1>

      {!openClock && (
        <div style={{
          background: 'var(--synapse-amber-50, #fff7e6)',
          border: '1px solid var(--synapse-amber-300, #ffd580)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--synapse-amber-800, #7a4a00)',
        }}>
          Vous n'êtes pas pointé(e). Pensez à pointer votre arrivée.
        </div>
      )}
      <ClockButton isClockedIn={!!openClock} />
      {onShiftNow && today && (
        <div style={{
          background: 'var(--synapse-green-500)',
          borderRadius: 'var(--radius-xl)',
          padding: '16px',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              background: 'rgba(255,255,255,0.25)', borderRadius: 99,
              padding: '2px 10px', fontSize: 12, fontWeight: 600,
            }}>En service</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {formatTime(today.start_time)} → {formatTime(today.end_time)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{today.role}</div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>Semaine</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAY_LABELS.map((label, i) => {
            const d = days.find((row) => row.day_of_week === i)
            const isToday = i === todayDow
            return (
              <div key={i} style={{
                background: isToday ? '#fff' : '#fafafa',
                border: isToday ? '1px solid var(--synapse-green-500)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                {d ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14 }}>{formatTime(d.start_time)} → {formatTime(d.end_time)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{d.role}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Repos</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {days.length === 0 && (
        <div style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '32px 16px',
          textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14,
        }}>
          Aucun horaire configuré
        </div>
      )}
    </div>
  )
}
