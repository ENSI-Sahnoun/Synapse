import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { startOfDay } from 'date-fns'
import { CheckinClient } from './CheckinClient'

export const metadata = {
  title: "Contrôle d'accès — Synapse",
}

export default async function EmployeeCheckinPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = startOfDay(new Date()).toISOString()

  const [{ data: openRows }, { count: todayTotal }] = await Promise.all([
    supabase
      .from('attendance')
      .select('id, checked_in_at, profiles!attendance_student_id_fkey(full_name)')
      .is('checked_out_at', null)
      .gte('checked_in_at', todayISO)
      .order('checked_in_at', { ascending: false }),
    supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('checked_in_at', todayISO),
  ])

  const openAttendance = (openRows ?? []).map((row) => ({
    id: row.id,
    studentName: (row.profiles as { full_name: string | null } | null)?.full_name ?? 'Inconnu',
    checkedInAt: row.checked_in_at,
  }))

  const currentlyIn = openAttendance.length
  const total = todayTotal ?? 0
  const checkedOut = total - currentlyIn

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Contrôle d&apos;accès
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Scannez le QR code d&apos;un étudiant pour valider son entrée.
        </p>
      </div>

      <CheckinClient
        initialOpenAttendance={openAttendance}
        todayTotal={total}
        currentlyIn={currentlyIn}
        checkedOut={checkedOut}
      />
    </div>
  )
}
