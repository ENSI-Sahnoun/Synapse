import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)', padding: '16px 14px',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default async function ReportsPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = startOfDay(new Date()).toISOString()

  const [purchasesResult, currentlyInResult, newMembersResult, hourlyResult] = await Promise.all([
    supabase
      .from('purchases')
      .select('purchase_items(price_dt, quantity)')
      .gte('created_at', todayISO),
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .is('checked_out_at', null),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student')
      .gte('created_at', todayISO),
    supabase
      .from('attendance')
      .select('checked_in_at')
      .gte('checked_in_at', todayISO),
  ])

  const revenueDt = (purchasesResult.data ?? []).reduce((sum, purchase) => {
    const items = purchase.purchase_items ?? []
    return sum + items.reduce((s: number, item: any) => s + (item.price_dt ?? 0) * (item.quantity ?? 1), 0)
  }, 0)

  const currentlyIn = currentlyInResult.count ?? 0
  const newMembers = newMembersResult.count ?? 0

  const hourlyCounts: Record<number, number> = {}
  for (let h = 8; h <= 20; h++) hourlyCounts[h] = 0
  for (const row of hourlyResult.data ?? []) {
    const h = new Date(row.checked_in_at).getHours()
    if (h >= 8 && h <= 20) hourlyCounts[h] = (hourlyCounts[h] ?? 0) + 1
  }
  const hours = Array.from({ length: 13 }, (_, i) => i + 8)
  const maxCount = Math.max(...hours.map(h => hourlyCounts[h] ?? 0), 1)

  return (
    <div className="p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Tableau de bord</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCard label="Revenus du jour" value={`${revenueDt.toFixed(3)} DT`} color="var(--accent-brand)" />
        <StatCard label="Présents" value={currentlyIn} color="var(--synapse-green-500)" />
        <StatCard label="Nouveaux membres" value={newMembers} color="var(--muted-foreground)" />
        <div />
      </div>

      <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Entrées par heure</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
          {hours.map(h => (
            <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%',
                background: 'var(--accent-brand)',
                borderRadius: 2,
                height: hourlyCounts[h] > 0 ? Math.max((hourlyCounts[h] / maxCount) * 72, 4) : 0,
              }} />
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{h}</span>
            </div>
          ))}
        </div>
      </div>

      <button style={{
        width: '100%', padding: '13px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        background: 'transparent',
        fontSize: 14, fontWeight: 600,
        color: 'var(--accent-brand)', cursor: 'pointer',
      }}>
        Télécharger rapport
      </button>
    </div>
  )
}
