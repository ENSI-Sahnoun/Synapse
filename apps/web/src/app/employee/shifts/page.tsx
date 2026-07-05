import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'

export const dynamic = 'force-dynamic'

function formatShiftTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ShiftsPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: shifts } = await (supabase.from('shifts' as never) as any)
    .select('id, start_time, end_time, role, notes')
    .eq('employee_id', userId)
    .order('start_time', { ascending: false })
    .limit(20)

  const now = new Date()
  const allShifts: any[] = shifts ?? []

  const currentShift = allShifts.find(s =>
    new Date(s.start_time) <= now && new Date(s.end_time) >= now
  )
  const upcomingShifts = allShifts
    .filter(s => new Date(s.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const pastShifts = allShifts.filter(s => new Date(s.end_time) < now)

  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Mes horaires</h1>

      {currentShift && (
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
            {formatShiftTime(currentShift.start_time)} → {formatShiftTime(currentShift.end_time)}
          </div>
          {currentShift.notes && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{currentShift.notes}</div>
          )}
        </div>
      )}

      {upcomingShifts.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>À venir</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingShifts.map((s: any) => (
              <div key={s.id} style={{
                background: '#fff', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '14px 16px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {formatShiftTime(s.start_time)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  → {formatShiftTime(s.end_time)}
                </div>
                {s.notes && (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pastShifts.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>Passés</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastShifts.map((s: any) => (
              <div key={s.id} style={{
                background: '#fafafa', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '14px 16px',
                opacity: 0.7,
              }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {formatShiftTime(s.start_time)} → {formatShiftTime(s.end_time)}
                </div>
                {s.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {allShifts.length === 0 && (
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
